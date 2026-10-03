"""Bar-by-bar simulation (D45, D61, D62): decide at the close, fill at the next open, shared cash.

Long only, one position per symbol, whole shares; amounts are integer paise. At each bar time,
for every stock with a bar then: (a) intraday day-change and square-off rules, pending sells at
the open; (b) pending buys at the open, best-ranked first while `portfolio` has free slots, sized
on each holding's previous close; (c) averaging adds (D53), then the stop (the highest of the
fixed, trailing and ATR levels), then the target; (d) the close is the last price, trailing
levels and bars held follow it, and signals queue new orders.
With `square_off` (intraday, D46) nothing is held past that IST time or overnight.
With a market filter (`when_off`, D62) no buy is queued at a close where it is off, and
`exit_all` also queues a sell of every holding there. Rotation (`rotation.py`) reuses this loop.
With `fills` (recorded runs, D82 (5)) prices come from the recorded quotes instead: the ask of the
first tick at or after a fill moment for a buy, its bid for a sell; stops, targets and adds fill at
the first tick in the bar that crosses their level. The spread cost is added up on every fill.
"""

import math
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal

from nova_contracts import Sizing
from nova_contracts.strategy import Averaging, Portfolio, Risk

from nova_backtest import exits
from nova_backtest.bars import Bar
from nova_backtest.book import Book, ChargesFn, ClosedTrade, percent_of, shares
from nova_backtest.columns import DAY_SECONDS, IST_OFFSET_SECONDS
from nova_backtest.quotes import Quote, QuoteBook
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
WhenOff = Literal["no_new_entries", "exit_all"]


@dataclass(frozen=True)
class Simulation:
    trades: list[ClosedTrade]
    equity: list[tuple[date, int]]  # end-of-day equity per IST trading date in the period
    spread_cost: int | None = None  # D82: Σ |fill − last price| × qty; None without `fills`


def _at(ts: int) -> datetime:
    return datetime.fromtimestamp(ts, UTC)


class Run:
    def __init__(
        self,
        book: Book,
        sizing: Sizing,
        risk: Risk,
        averaging: Averaging | None,
        square_off: time | None,
        portfolio: Portfolio | None,
        when_off: WhenOff | None = None,
        fills: QuoteBook | None = None,
    ) -> None:
        self.book, self.sizing, self.risk, self.averaging = book, sizing, risk, averaging
        self.fills = fills
        self.spread = 0
        self.portfolio, self.when_off = portfolio, when_off
        cut = square_off
        self.cut = None if cut is None else cut.hour * 3600 + cut.minute * 60 + cut.second
        self.pending: dict[str, str] = {}
        self.signal_rank: dict[str, float] = {}  # rank at the close that queued a buy (D62)
        self.previous: dict[str, tuple[int, int, int]] = {}  # symbol → (ts, day, close)

    def _price(self, quote: Quote | None, default: int) -> tuple[int, int]:
        """(fill, last price) from a recorded quote, else the bar price for both."""
        return (quote.price, quote.ltp) if quote is not None else (default, default)

    def _sell(self, bar: BarAt, default: int, quote: Quote | None = None) -> None:
        """Closes the whole holding of `bar.symbol`, at `quote` or the first tick from the bar."""
        if self.fills is not None and quote is None:
            quote = self.fills.at(bar.symbol, bar.ts, "sell")
        price, ltp = self._price(quote, default)
        self.spread += abs(price - ltp) * self.book.positions[bar.symbol].qty
        self.book.close(bar.symbol, _at(bar.ts), price)

    def warm_up(self, bar: BarAt) -> None:
        """A bar before the start: only its close is remembered."""
        self.book.last_close[bar.symbol] = bar.close
        self.previous[bar.symbol] = (bar.ts, bar.day, bar.close)

    def begin(self, group: list[BarAt]) -> None:
        """Called once per bar time in the period, before step a (rotation decides here)."""

    def average_down(self, bar: BarAt) -> None:
        """Resting buys below the last buy (D53); a stop at or above the trigger fills first."""
        position = self.book.positions[bar.symbol]
        averaging = self.averaging
        while averaging is not None and position.adds < averaging.max_adds:
            trigger = percent_of(position.last_buy, 100 - averaging.drop_percent)
            stop_price = exits.stop_level(position, self.risk)
            if bar.low > trigger or (stop_price is not None and stop_price >= trigger):
                return
            quote = None
            if self.fills is not None:
                quote = self.fills.cross(bar.symbol, bar.ts, trigger, below=True, side="buy")
            fill, ltp = self._price(quote, min(bar.open, trigger))
            qty = shares(self.sizing, self.book.worth(), fill)
            if qty < 1 or qty * fill > self.book.cash:
                return
            self.spread += abs(fill - ltp) * qty
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
                    self._sell(bar, bar.open)
                return False
        if self.pending.get(symbol) == "exit":
            del self.pending[symbol]
            if symbol in book.positions:
                self._sell(bar, bar.open)
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
            quote = None if self.fills is None else self.fills.at(bar.symbol, bar.ts, "buy")
            price, ltp = self._price(quote, bar.open)
            qty = shares(self.sizing, book.worth(), price)
            if qty >= 1 and qty * price <= book.cash:
                self.spread += abs(price - ltp) * qty
                book.open(bar.symbol, _at(bar.ts), qty, price)

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
        fills = self.fills
        if stop_price is not None and bar.low <= stop_price:
            cross = None if fills is None else fills.cross(symbol, bar.ts, stop_price, True, "sell")
            self._sell(bar, min(bar.open, stop_price), cross)
        elif target_price is not None and bar.high >= target_price:
            cross = (
                None if fills is None else fills.cross(symbol, bar.ts, target_price, False, "sell")
            )
            self._sell(bar, max(bar.open, target_price), cross)

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
            if bar.exit or exits.held_long_enough(position, self.risk) or self.all_out(bar):
                self.pending[symbol] = "exit"
        elif bar.enter and bar.regime:
            self.pending[symbol] = "enter"
            self.signal_rank[symbol] = bar.rank

    def all_out(self, bar: BarAt) -> bool:
        """The market filter is off at this close and says to sell everything (D62)."""
        return not bar.regime and self.when_off == "exit_all"


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
    when_off: WhenOff | None = None,
    fills: QuoteBook | None = None,
) -> Simulation:
    book = Book(cash, charges)
    run = Run(book, sizing, risk, averaging, square_off, portfolio, when_off, fills)
    return run_loop(store, run, start, on_bar, window_bars)


def run_loop(
    store: Store, run: Run, start: datetime, on_bar: OnBar | None, window_bars: int
) -> Simulation:
    """Every bar time in order: warm-up bars, then steps a–d for each bar time in the period."""
    book = run.book
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
                run.warm_up(bar)
            continue
        bar_day = group[0].day
        if day is not None and bar_day != day:
            equity.append((EPOCH + timedelta(days=day), book.worth()))
        day = bar_day
        run.begin(group)
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
    spread = None if run.fills is None else run.spread
    return Simulation(trades=book.trades, equity=equity, spread_cost=spread)


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
    regimes: Mapping[str, Sequence[bool]] | None = None,
    when_off: WhenOff | None = None,
) -> Simulation:
    """The same simulation over in-memory `Bar` lists (tests, small runs)."""
    store = MemoryStore.from_bars(bars, signals, ranks, atrs, regimes)
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
        when_off,
    )
