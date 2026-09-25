"""Bar-by-bar simulation (D45): decide at close, fill next open, stop before target, shared cash.

Long only, one position per symbol, whole shares. Amounts are integer paise throughout.
With `square_off` (intraday, D46) nothing is held past that IST time or overnight.
With `averaging` (D53) a held position buys again each X% fall below its last buy, up to N times;
stop and target then follow the average price, and the position stays one trade.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol

from nova_contracts import Charges, Sizing
from nova_contracts.strategy import Averaging, Risk, SizingFixedAmount, SizingFixedQty

from nova_backtest.bars import IST, Bar

# (qty, entry price, exit price, entry time) → charges of the whole trade.
ChargesFn = Callable[[int, int, int, datetime], Charges]


class Signals(Protocol):
    """Whether a strategy wants in or out at the close of bar `i` of `symbol`."""

    def enter(self, symbol: str, i: int) -> bool: ...

    def exit(self, symbol: str, i: int) -> bool: ...


@dataclass(frozen=True)
class ClosedTrade:
    symbol: str
    qty: int
    entry_at: datetime
    entry_price: int
    exit_at: datetime
    exit_price: int
    charges: Charges
    cost: int | None = None  # exact paise paid for all buys; None = qty × entry price (D53)

    @property
    def gross(self) -> int:
        paid = self.cost if self.cost is not None else self.entry_price * self.qty
        return self.exit_price * self.qty - paid

    @property
    def net(self) -> int:
        return self.gross - self.charges.total_paise


@dataclass
class _Position:
    qty: int
    entry_at: datetime
    cost: int  # exact paise paid for every buy
    last_buy: int  # price of the latest buy: the next add triggers below it (D53)
    adds: int = 0

    @property
    def average(self) -> int:
        """Average buy price, half-up paise."""
        value = Decimal(self.cost) / self.qty
        return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))

    def buy(self, qty: int, price: int) -> None:
        self.qty += qty
        self.cost += qty * price
        self.last_buy = price


@dataclass(frozen=True)
class Simulation:
    trades: list[ClosedTrade]
    equity: list[tuple[date, int]]  # end-of-day equity per IST trading date in the period


def _percent_of(amount: int, percent: float) -> int:
    value = Decimal(amount) * Decimal(str(percent)) / 100
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def shares(sizing: Sizing, equity: int, price: int) -> int:
    if isinstance(sizing, SizingFixedQty):
        return sizing.qty
    if isinstance(sizing, SizingFixedAmount):
        return sizing.amount_paise // price
    return _percent_of(equity, sizing.percent) // price


def simulate(
    bars: dict[str, list[Bar]],
    signals: Signals,
    sizing: Sizing,
    risk: Risk,
    cash: int,
    start: datetime,
    charges: ChargesFn,
    square_off: time | None = None,
    averaging: Averaging | None = None,
) -> Simulation:
    events = sorted(
        ((bar.ts, symbol, i) for symbol, series in bars.items() for i, bar in enumerate(series)),
        key=lambda event: (event[0], event[1]),
    )
    positions: dict[str, _Position] = {}
    pending: dict[str, str] = {}
    last_close: dict[str, int] = {}
    trades: list[ClosedTrade] = []
    equity: list[tuple[date, int]] = []

    def worth() -> int:
        return cash + sum(p.qty * last_close[s] for s, p in positions.items())

    def close(symbol: str, at: datetime, price: int) -> None:
        nonlocal cash
        position = positions.pop(symbol)
        entry = position.average
        cost = charges(position.qty, entry, price, position.entry_at)
        trades.append(
            ClosedTrade(
                symbol, position.qty, position.entry_at, entry, at, price, cost, position.cost
            )
        )
        cash += position.qty * price - cost.total_paise

    def stop_price_of(position: _Position) -> int | None:
        stop = risk.stop_loss_percent
        return _percent_of(position.average, 100 - stop) if stop else None

    def average_down(symbol: str, bar: Bar) -> None:
        """Resting buys below the last buy (D53); a stop at or above the trigger fills first."""
        nonlocal cash
        position = positions[symbol]
        while averaging is not None and position.adds < averaging.max_adds:
            trigger = _percent_of(position.last_buy, 100 - averaging.drop_percent)
            stop_price = stop_price_of(position)
            if bar.low > trigger or (stop_price is not None and stop_price >= trigger):
                return
            fill = min(bar.open, trigger)
            qty = shares(sizing, worth(), fill)
            if qty < 1 or qty * fill > cash:
                return
            position.buy(qty, fill)
            position.adds += 1
            cash -= qty * fill

    day: date | None = None
    for ts, symbol, i in events:
        bar = bars[symbol][i]
        if ts < start:
            last_close[symbol] = bar.close
            continue
        if day is not None and bar.ist_date != day:
            equity.append((day, worth()))
        day = bar.ist_date

        if square_off is not None:
            previous = bars[symbol][i - 1] if i else None
            if previous is not None and previous.ist_date != bar.ist_date:
                pending.pop(symbol, None)  # nothing carries over to a new day
                if symbol in positions:  # late bars were missing: close at the last seen price
                    close(symbol, previous.ts, previous.close)
            if bar.ts.astimezone(IST).time() >= square_off:
                pending.pop(symbol, None)
                if symbol in positions:
                    close(symbol, ts, bar.open)
                last_close[symbol] = bar.close
                continue

        order = pending.pop(symbol, None)
        if order == "exit" and symbol in positions:
            close(symbol, ts, bar.open)
        elif order == "enter" and symbol not in positions:
            qty = shares(sizing, worth(), bar.open)
            if qty >= 1 and qty * bar.open <= cash:
                positions[symbol] = _Position(qty, ts, qty * bar.open, bar.open)
                cash -= qty * bar.open

        position = positions.get(symbol)
        if position is not None:
            average_down(symbol, bar)
            target = risk.target_percent
            stop_price = stop_price_of(position)
            target_price = _percent_of(position.average, 100 + target) if target else None
            if stop_price is not None and bar.low <= stop_price:
                close(symbol, ts, min(bar.open, stop_price))
            elif target_price is not None and bar.high >= target_price:
                close(symbol, ts, max(bar.open, target_price))

        last_close[symbol] = bar.close
        if symbol in positions:
            if signals.exit(symbol, i):
                pending[symbol] = "exit"
        elif signals.enter(symbol, i):
            pending[symbol] = "enter"

    for symbol in list(positions):
        final = bars[symbol][-1]
        close(symbol, final.ts, final.close)
    if day is not None:
        equity.append((day, worth()))
    return Simulation(trades=trades, equity=equity)
