"""Trade: mirrors `frontend/packages/contracts/src/trade.ts`."""

from typing import Annotated, Self

from pydantic import Field, model_validator

from nova_contracts.charges import Charges
from nova_contracts.common import Contract, Exchange, Id, Paise, Segment, Side, UtcDateTime

PositivePaise = Annotated[int, Field(gt=0)]


class Trade(Contract):
    id: Id
    run_id: Id
    symbol: Annotated[str, Field(min_length=1)]
    exchange: Exchange
    segment: Segment
    side: Side
    qty: Annotated[int, Field(gt=0)]
    entry_at: UtcDateTime
    entry_price_paise: PositivePaise
    exit_at: UtcDateTime | None
    exit_price_paise: PositivePaise | None
    gross_pnl_paise: Paise
    charges: Charges
    net_pnl_paise: Paise

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.net_pnl_paise != self.gross_pnl_paise - self.charges.total_paise:
            raise ValueError("netPnlPaise must equal grossPnlPaise minus charges.totalPaise")
        if (self.exit_at is None) != (self.exit_price_paise is None):
            raise ValueError("exitAt and exitPricePaise must both be null or both be set")
        return self
