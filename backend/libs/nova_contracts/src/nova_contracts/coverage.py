"""Stored data (D63): mirrors `frontend/packages/contracts/src/coverage.ts`."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, IsoDate
from nova_contracts.market_data import IndexName

CoverageTimeframe = Literal["1m", "1d"]
CoverageStatus = Literal["complete", "gaps", "partial", "none", "unavailable"]
Count = Annotated[int, Field(ge=0)]
NonEmpty = Annotated[str, Field(min_length=1)]


class CoverageRow(Contract):
    """One stock or index: its whole stored range; days and status counted inside the period."""

    symbol: NonEmpty
    name: NonEmpty
    kind: Literal["stock", "index"]
    sector: NonEmpty
    indices: list[IndexName]
    first_day: IsoDate | None
    last_day: IsoDate | None
    days: Count
    missing_days: Count
    status: CoverageStatus
    unavailable_days: Count = 0

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if (self.status == "none") != (self.days == 0):
            raise ValueError("status is none exactly when no day is stored in the period")
        if (self.first_day is None) != (self.last_day is None):
            raise ValueError("firstDay and lastDay are both set or both null")
        if self.status == "complete" and self.missing_days:
            raise ValueError("a complete row has no missing days")
        if self.unavailable_days > self.missing_days:
            raise ValueError("unavailable days cannot exceed missing days")
        if self.days and self.first_day is None:
            raise ValueError("a row with days has a stored range")
        return self


class _Period(Contract):
    from_: IsoDate = Field(alias="from")
    to: IsoDate

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.from_ > self.to:
            raise ValueError("from must be on or before to")
        return self


class CoverageList(_Period):
    timeframe: CoverageTimeframe
    calendar: Literal["index", "stocks"]
    rows: list[CoverageRow]
    total: Count


class MissingRange(_Period):
    days: Annotated[int, Field(ge=1)]


class CoverageDetail(_Period):
    symbol: NonEmpty
    timeframe: CoverageTimeframe
    first_day: IsoDate | None
    last_day: IsoDate | None
    days: Count
    missing_days: Count
    missing: list[MissingRange]
    unavailable_days: Count = 0

    @model_validator(mode="after")
    def _adds_up(self) -> Self:
        if self.unavailable_days > self.missing_days:
            raise ValueError("unavailable days cannot exceed missing days")
        if sum(m.days for m in self.missing) != self.missing_days:
            raise ValueError("missing ranges add up to missingDays")
        return self
