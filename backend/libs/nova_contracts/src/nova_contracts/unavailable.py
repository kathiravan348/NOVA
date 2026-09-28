"""A broker-unavailable date and its check history (D70)."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Id, IsoDate, UtcDateTime
from nova_contracts.coverage import CoverageTimeframe


class UnavailableDay(Contract):
    id: Id
    exchange: Literal["NSE"]
    symbol: Annotated[str, Field(min_length=1)]
    timeframe: CoverageTimeframe
    day: IsoDate
    broker: Literal["Zerodha"]
    reason: Literal["no_usable_candle"]
    first_checked_at: UtcDateTime
    last_checked_at: UtcDateTime
    attempts: Annotated[int, Field(ge=1)]
    last_job_id: Id | None
    resolved_at: UtcDateTime | None
    status: Literal["unavailable", "resolved"]

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.last_checked_at < self.first_checked_at:
            raise ValueError("last check must not precede first check")
        if (self.status == "resolved") != (self.resolved_at is not None):
            raise ValueError("resolved status must have a resolution time")
        return self
