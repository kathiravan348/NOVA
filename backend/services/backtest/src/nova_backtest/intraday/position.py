"""One intraday position (D84 §4, §5.1): its buys, its fixed stop and target, its exits.

Amounts are exact integer paise: each buy or sell order keeps Σ shares × price of its fills and its
own charges (NOVA Ledger, per order). The stop, the target and 1R never move once the first buy
filled. A position with two buys is still one trade; its entry price is the rounded average.
"""

from collections.abc import Callable
from dataclasses import dataclass, field

from nova_contracts import Charges
from nova_contracts.trade import ExitReason

from nova_backtest.book import ClosedTrade
from nova_backtest.intraday.setups import Candidate
from nova_backtest.intraday.tick_data import at_ms

# (side, order value in paise, moment in epoch ms) → that order's charges.
OrderCharges = Callable[[str, int, int], Charges]
CHARGE_FIELDS = (
    "brokerage_paise",
    "stt_paise",
    "exchange_txn_paise",
    "sebi_fee_paise",
    "stamp_duty_paise",
    "gst_paise",
    "dp_paise",
)


def add_charges(parts: list[Charges]) -> Charges:
    sums = {name: sum(getattr(c, name) for c in parts) for name in CHARGE_FIELDS}
    return Charges.model_validate(sums | {"total_paise": sum(sums.values())})


@dataclass
class Order:
    at_ms: int
    qty: int
    value: int  # Σ shares × price (paise)
    charges: Charges


@dataclass
class Position:
    candidate: Candidate
    opened_ms: int
    stop: int
    target: int | None
    first_fill: int  # rounded average price of the first buy
    buys: list[Order] = field(default_factory=list)
    sells: list[Order] = field(default_factory=list)
    exit_reason: ExitReason | None = None
    exit_from_ms: int | None = None  # earliest moment the exit may fill (trigger + delay)
    unresolved: bool = False

    @property
    def symbol(self) -> str:
        return self.candidate.symbol

    @property
    def risk(self) -> int:
        """1R per share: first fill − stop."""
        return self.first_fill - self.stop

    @property
    def bought(self) -> int:
        return sum(o.qty for o in self.buys)

    @property
    def held(self) -> int:
        return self.bought - sum(o.qty for o in self.sells)

    @property
    def cost(self) -> int:
        return sum(o.value for o in self.buys)

    @property
    def closed(self) -> bool:
        return self.held == 0

    def trigger(self, reason: ExitReason, moment_ms: int, delay_ms: int) -> None:
        """Marks the exit; the first fill may come at `moment_ms + delay_ms`."""
        if self.exit_reason is None:
            self.exit_reason = reason
            self.exit_from_ms = moment_ms + delay_ms

    def trade(self) -> ClosedTrade:
        """The closed position as one trade (all buys, all sells, every order's charges)."""
        qty, cost = self.bought, self.cost
        proceeds = sum(o.value for o in self.sells)
        last = self.sells[-1].at_ms if self.sells else self.opened_ms
        return ClosedTrade(
            symbol=self.symbol,
            qty=qty,
            entry_at=at_ms(self.buys[0].at_ms),
            entry_price=round(cost / qty),
            exit_at=at_ms(last),
            exit_price=max(round(proceeds / qty), 1),
            charges=add_charges([o.charges for o in self.buys + self.sells]),
            cost=cost,
            exit_reason=self.exit_reason,
            proceeds=proceeds,
        )

    def legs(self) -> list[dict[str, object]]:
        """`intraday_trades.legs`: each buy's time, shares and average price."""
        return [
            {"at": at_ms(o.at_ms).isoformat(), "qty": o.qty, "price": round(o.value / o.qty)}
            for o in self.buys
        ]
