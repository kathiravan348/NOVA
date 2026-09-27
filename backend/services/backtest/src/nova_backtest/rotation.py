"""Rotation mode (D62 (4)): each period, hold the best-scored stocks, equal weight.

Pass 1 saves each stock's `score` (weighted sum of its terms; NaN when a term has no value) and
whether it passes the `filter`. A rebalance happens at the first bar time on or after the start,
at the first bar time of each new ISO week, month or quarter (IST dates), and at the bar time
after the market filter turns back on. It decides on each stock's previous close and fills at the
rebalance bar's open, which is the same as deciding at the period's last close.

At a rebalance, stocks with a bar then, passing the filter and with a score are ranked high to
low. Step a sells holdings ranked below `keepWithin` or failing the filter (a holding without a
bar then is kept); step b buys the best not held up to `hold`, each for worth ÷ `hold` at the
open (whole shares, capped by cash). With the market filter off there are no buys; `exit_all`
has already sold everything. Between rebalances the stop-loss, trailing and ATR stops, target
and bars-held exit apply as in the other modes.
"""

import math
from collections.abc import Mapping
from datetime import UTC, date, datetime, timedelta

import numpy as np
from nova_contracts.strategy import Risk, Rotation, SizingPercentEquity

from nova_backtest import exits
from nova_backtest.book import Book, ChargesFn
from nova_backtest.columns import Columns
from nova_backtest.rules import SeriesCache, group_holds
from nova_backtest.scratch import Bools, Floats, Store
from nova_backtest.simulate import OnBar, Run, Simulation, WhenOff, run_loop
from nova_backtest.timeline import BarAt

EPOCH = date(1970, 1, 1)
# Rotation sizes each buy as worth ÷ hold; the base runner's sizing is never used.
UNUSED_SIZING = SizingPercentEquity(type="percent_equity", percent=100)


def rotation_arrays(columns: Columns, rotation: Rotation) -> tuple[Floats, Bools]:
    """One stock's score and filter at each close."""
    cache = SeriesCache(columns)
    score = np.zeros(len(columns), dtype=np.float64)
    for term in rotation.score:
        score = score + term.weight * cache.values(term.operand)  # NaN stays NaN
    if rotation.filter is None:
        return score, np.ones(len(columns), dtype=np.bool_)
    return score, group_holds(rotation.filter, cache)


def period_of(day: int, rebalance: str) -> tuple[int, int]:
    """The ISO week, month or quarter of an IST day number."""
    when = EPOCH + timedelta(days=day)
    if rebalance == "weekly":
        iso = when.isocalendar()
        return iso.year, iso.week
    if rebalance == "monthly":
        return when.year, when.month
    return when.year, (when.month - 1) // 3


class RotationRun(Run):
    def __init__(
        self, book: Book, rotation: Rotation, risk: Risk, when_off: WhenOff | None
    ) -> None:
        super().__init__(book, UNUSED_SIZING, risk, None, None, None, when_off)
        self.rotation = rotation
        self.score: dict[str, float] = {}  # at each stock's latest close
        self.eligible: dict[str, bool] = {}
        self.regime_on = True  # the market filter at the latest close
        self.period: tuple[int, int] | None = None
        self.rebalance_next = True  # the first bar time on or after the start
        self.rebalancing = False
        self.ranked: list[str] = []
        self.rank_of: dict[str, int] = {}

    def _remember(self, bar: BarAt) -> None:
        self.score[bar.symbol] = bar.rank
        self.eligible[bar.symbol] = bar.enter
        if bar.regime and not self.regime_on:
            self.rebalance_next = True  # the filter is back on: rebalance at the next bar time
        self.regime_on = bar.regime

    def warm_up(self, bar: BarAt) -> None:
        super().warm_up(bar)
        self._remember(bar)

    def begin(self, group: list[BarAt]) -> None:
        period = period_of(group[0].day, self.rotation.rebalance)
        self.rebalancing = self.rebalance_next or period != self.period
        self.period, self.rebalance_next = period, False
        if not self.rebalancing:
            return
        ranked = [
            b.symbol
            for b in group
            if self.eligible.get(b.symbol, False)
            and not math.isnan(self.score.get(b.symbol, math.nan))
        ]
        ranked.sort(key=lambda symbol: (-self.score[symbol], symbol))
        self.ranked = ranked
        self.rank_of = {symbol: k for k, symbol in enumerate(ranked, start=1)}

    def sells(self, bar: BarAt) -> bool:
        super().sells(bar)  # exits queued at the last close (market filter, bars held)
        book, symbol = self.book, bar.symbol
        if self.rebalancing and symbol in book.positions:
            rank = self.rank_of.get(symbol)
            if rank is None or rank > self.rotation.keep_within:
                book.close(symbol, datetime.fromtimestamp(bar.ts, UTC), bar.open)
        return True

    def buys(self, group: list[BarAt], active: Mapping[str, bool]) -> None:
        if not self.rebalancing or not self.regime_on:
            return
        book, hold = self.book, self.rotation.hold
        budget = book.worth() // hold  # on every holding's previous close
        bars = {b.symbol: b for b in group}
        for symbol in self.ranked:
            if len(book.positions) >= hold:
                return
            if symbol in book.positions:
                continue
            bar = bars[symbol]
            qty = min(budget, book.cash) // bar.open
            if qty >= 1:
                book.open(symbol, datetime.fromtimestamp(bar.ts, UTC), qty, bar.open)

    def at_close(self, bar: BarAt, active: bool) -> None:
        symbol = bar.symbol
        self.book.last_close[symbol] = bar.close
        self.previous[symbol] = (bar.ts, bar.day, bar.close)
        position = self.book.positions.get(symbol)
        if position is not None:
            exits.at_close(position, bar.close, self.risk, bar.atr)
            if exits.held_long_enough(position, self.risk) or self.all_out(bar):
                self.pending[symbol] = "exit"
        self._remember(bar)


def simulate_rotation(
    store: Store,
    rotation: Rotation,
    risk: Risk,
    cash: int,
    start: datetime,
    charges: ChargesFn,
    when_off: WhenOff | None = None,
    on_bar: OnBar | None = None,
    window_bars: int = 500_000,
) -> Simulation:
    run = RotationRun(Book(cash, charges), rotation, risk, when_off)
    return run_loop(store, run, start, on_bar, window_bars)
