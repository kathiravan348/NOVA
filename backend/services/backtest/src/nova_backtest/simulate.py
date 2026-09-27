"""Bar-by-bar simulation (D45, D61, D62): decide at the close, fill at the next open, shared cash.

Long only, one position per symbol, whole shares; amounts are integer paise. At each bar time,
for every stock with a bar then: (a) intraday day-change and square-off rules, pending sells at
the open; (b) pending buys at the open, best-ranked first while `portfolio` has free slots, sized
on each holding's previous close; (c) averaging adds (D53), then the stop (the highest of the
fixed, trailing and ATR levels), then the target; (d) the close is the last price, trailing
levels and bars held follow it, and signals queue new orders.
With `square_off` (intraday, D46) nothing is held past that IST time or overnight.
"""

import math
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

from nova_contracts import Sizing
from nova_contracts.strategy import Averaging, Portfolio, Risk

from nova_backtest import exits
from nova_backtest.bars import Bar
from nova_backtest.book import Book, ChargesFn, ClosedTrade, percent_of, shares
from nova_backtest.columns import DAY_SECONDS, IST_OFFSET_SECONDS
from nova_backtest.scratch import MemoryStore, Signals, Store
from nova_backtest.timeline import BarAt, walk

__all__ = [
    "ChargesFn",
    "ClosedTrade",
    "Signals",
    "Simulation",
    "shares",
    "simulate",
    "simulate_bars",
]

# (bars done, time of the last one, trades closed so far) → progress (D58).
OnBar = Callable[[int, datetime, int], None]
ON_BAR_EVERY = 1_000
EPOCH = date(1970, 1, 1)


@dataclass(frozen=True)
class Simulation:
    trades: list[ClosedTrade]
    equity: list[tuple[date, int]]  # end-of-day equity per IST trading date in the period


def _at(ts: int) -> datetime:
    return datetime.fromtimestamp(ts, UTC)


class _Run:
    def __init__(
        self,
        book: Book,
        sizing: Sizing,
        risk: Risk,
        averaging: Averaging | None,
        square_off: time | None,
        portfolio: Portfolio | None,
    ) -> None:
        self.book, self.sizing, self.risk, self.averaging = book, sizing, risk, averaging
        self.portfolio = portfolio
        cut = square_off
        self.cut = None if cut is None else cut.hour * 3600 + cut.minute * 60 + cut.second
        self.pending: dict[str, str] = {}
        self.signal_rank: dict[str, float] = {}  # rank at the close that queued a buy (D62)
        self.previous: dict[str, tuple[int, int, int]] = {}  # symbol → (ts, day, close)

    def average_down(self, bar: BarAt) -> None:
        """Resting buys below the last buy (D53); a stop at or above the trigger fills first."""
        position = self.book.positions[bar.symbol]
        averaging = self.averaging
        while averaging is not None and position.adds < averaging.max_adds:
            trigger = percent_of(position.last_buy, 100 - averaging.drop_percent)
            stop_price = exits.stop_level(position, self.risk)
            if bar.low > trigger or (stop_price is not None and stop_price >= trigger):
                return
            fill = min(bar.open, trigger)
            qty = shares(self.sizing, self.book.worth(), fill)
            if qty < 1 or qty * fill > self.book.cash:
                return
            self.book.add(bar.symbol, qty, fill)
            position.adds += 1

    def sells(self, bar: BarAt) -> bool:
        """Step a. False when the bar is at or after the square-off time (nothing else happens)."""
        book, symbol = self.book, bar.symbol
        if self.cut is not None:
            previous = self.previous.get(symbol)
            if previous is not None and previous[1] != bar.day:
                self.pending.pop(symbol, None)  # nothing carries over to a new day
                if symbol in book.positions:  # late bars were missing: close at the last seen price
                    book.close(symbol, _at(previous[0]), previous[2])
            if (bar.ts + IST_OFFSET_SECONDS) % DAY_SECONDS >= self.cut:
                self.pending.pop(symbol, None)
                if symbol in book.positions:
                    book.close(symbol, _at(bar.ts), bar.open)
                return False
        if self.pending.get(symbol) == "exit":
            del self.pending[symbol]
            if symbol in book.positions:
                book.close(symbol, _at(bar.ts), bar.open)
        return True

    def _rank_key(self, bar: BarAt) -> tuple[bool, float, str]:
        """Best first: by the rank at the signal close (D62), NaN last, ties by symbol."""
        portfolio = self.portfolio
        if portfolio is None or portfolio.rank is None:
            return (False, 0.0, bar.symbol)
        value = self.signal_rank.get(bar.symbol, math.nan)
        if math.isnan(value):
            return (True, 0.0, bar.symbol)
        return (False, -value if portfolio.rank.order == "desc" else value, bar.symbol)

    def buys(self, group: list[BarAt], active: Mapping[str, bool]) -> None:
        """Step b: waiting buys fill at the open while slots and cash allow; others are dropped."""
        waiting = [b for b in group if active[b.symbol] and self.pending.get(b.symbol) == "enter"]
        waiting.sort(key=self._rank_key)
        for bar in waiting:
            del self.pending[bar.symbol]
        book = self.book
        slots = None if self.portfolio is None else self.portfolio.max_positions
        for bar in waiting:
            if slots is not None and len(book.positions) >= slots:
                return
            if bar.symbol in book.positions:
                continue
            qty = shares(self.sizing, book.worth(), bar.open)
            if qty >= 1 and qty * bar.open <= book.cash:
                book.open(bar.symbol, _at(bar.ts), qty, bar.open)

    def risk_exits(self, bar: BarAt) -> None:
        """Step c: adds, then stop before target, inside the bar."""
        book, symbol = self.book, bar.symbol
        if symbol not in book.positions:
            return
        self.average_down(bar)
        position = book.positions[symbol]
        target = self.risk.target_percent
        stop_price = exits.stop_level(position, self.risk)
        target_price = percent_of(position.average, 100 + target) if target else None
        if stop_price is not None and bar.low <= stop_price:
            book.close(symbol, _at(bar.ts), min(bar.open, stop_price))
        elif target_price is not None and bar.high >= target_price:
            book.close(symbol, _at(bar.ts), max(bar.open, target_price))

    def at_close(self, bar: BarAt, active: bool) -> None:
        """Step d: the close is the last price; holdings follow it; signals queue new orders."""
        symbol = bar.symbol
        self.book.last_close[symbol] = bar.close
        self.previous[symbol] = (bar.ts, bar.day, bar.close)
        if not active:
            return
        position = self.book.positions.get(symbol)
        if position is not None:
            exits.at_close(position, bar.close, self.risk, bar.atr)
            if bar.exit or exits.held_long_enough(position, self.risk):
                self.pending[symbol] = "exit"
        elif bar.enter:
            self.pending[symbol] = "enter"
            self.signal_rank[symbol] = bar.rank


def simulate(
    store: Store,
    sizing: Sizing,
    risk: Risk,
    cash: int,
    start: datetime,
    charges: ChargesFn,
    square_off: time | None = None,
    averaging: Averaging | None = None,
    on_bar: OnBar | None = None,
    window_bars: int = 500_000,
    portfolio: Portfolio | None = None,
) -> Simulation:
    book = Book(cash, charges)
    run = _Run(book, sizing, risk, averaging, square_off, portfolio)
    equity: list[tuple[date, int]] = []
    first = int(start.timestamp())
    day: int | None = None
    done, last_ts = 0, None
    for ts, group in walk(store, window_bars):
        if (
            on_bar is not None
            and done
            and done // ON_BAR_EVERY != (done + len(group)) // ON_BAR_EVERY
        ):
            on_bar(done, _at(ts), len(book.trades))
        done += len(group)
        last_ts = ts
        if ts < first:
            for bar in group:
                book.last_close[bar.symbol] = bar.close
                run.previous[bar.symbol] = (bar.ts, bar.day, bar.close)
            continue
        bar_day = group[0].day
        if day is not None and bar_day != day:
            equity.append((EPOCH + timedelta(days=day), book.worth()))
        day = bar_day
        active = {bar.symbol: run.sells(bar) for bar in group}
        run.buys(group, active)
        for bar in group:
            if active[bar.symbol]:
                run.risk_exits(bar)
        for bar in group:
            run.at_close(bar, active[bar.symbol])
    for symbol in list(book.positions):
        final_ts, _, final_close = run.previous[symbol]
        book.close(symbol, _at(final_ts), final_close)
    if day is not None:
        equity.append((EPOCH + timedelta(days=day), book.worth()))
    if on_bar is not None and last_ts is not None:
        on_bar(done, _at(last_ts), len(book.trades))
    return Simulation(trades=book.trades, equity=equity)


def simulate_bars(
    bars: Mapping[str, Sequence[Bar]],
    signals: Signals,
    sizing: Sizing,
    risk: Risk,
    cash: int,
    start: datetime,
    charges: ChargesFn,
    square_off: time | None = None,
    averaging: Averaging | None = None,
    on_bar: OnBar | None = None,
    window_bars: int = 500_000,
    portfolio: Portfolio | None = None,
    ranks: Mapping[str, Sequence[float]] | None = None,
    atrs: Mapping[str, Sequence[float]] | None = None,
) -> Simulation:
    """The same simulation over in-memory `Bar` lists (tests, small runs)."""
    store = MemoryStore.from_bars(bars, signals, ranks, atrs)
    return simulate(
        store,
        sizing,
        risk,
        cash,
        start,
        charges,
        square_off,
        averaging,
        on_bar,
        window_bars,
        portfolio,
    )
