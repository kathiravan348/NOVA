"""Cash, open positions and closed trades of one simulation (D45, D53); amounts in paise."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from nova_contracts import Charges, Sizing
from nova_contracts.strategy import SizingFixedAmount, SizingFixedQty

# (qty, entry price, exit price, entry time) → charges of the whole trade.
ChargesFn = Callable[[int, int, int, datetime], Charges]


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
class Position:
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


def percent_of(amount: int, percent: float) -> int:
    value = Decimal(amount) * Decimal(str(percent)) / 100
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def shares(sizing: Sizing, equity: int, price: int) -> int:
    if isinstance(sizing, SizingFixedQty):
        return sizing.qty
    if isinstance(sizing, SizingFixedAmount):
        return sizing.amount_paise // price
    return percent_of(equity, sizing.percent) // price


class Book:
    def __init__(self, cash: int, charges: ChargesFn) -> None:
        self.cash = cash
        self.positions: dict[str, Position] = {}
        self.trades: list[ClosedTrade] = []
        self.last_close: dict[str, int] = {}
        self._charges = charges

    def worth(self) -> int:
        """Cash plus every holding at its last known close."""
        return self.cash + sum(p.qty * self.last_close[s] for s, p in self.positions.items())

    def open(self, symbol: str, at: datetime, qty: int, price: int) -> None:
        self.positions[symbol] = Position(qty, at, qty * price, price)
        self.cash -= qty * price

    def add(self, symbol: str, qty: int, price: int) -> None:
        self.positions[symbol].buy(qty, price)
        self.cash -= qty * price

    def close(self, symbol: str, at: datetime, price: int) -> None:
        position = self.positions.pop(symbol)
        entry = position.average
        cost = self._charges(position.qty, entry, price, position.entry_at)
        self.trades.append(
            ClosedTrade(
                symbol, position.qty, position.entry_at, entry, at, price, cost, position.cost
            )
        )
        self.cash += position.qty * price - cost.total_paise
