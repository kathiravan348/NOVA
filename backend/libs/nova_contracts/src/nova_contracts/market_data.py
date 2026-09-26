"""Instrument and Candle: mirror `frontend/packages/contracts/src/marketData.ts`."""

from typing import Annotated, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Exchange, IsoDate, Segment, Timeframe, UtcDateTime

# Any `market_indices` row (D56); the API checks the name exists on write.
IndexName = Annotated[str, Field(min_length=1, max_length=40, pattern=r"^[A-Z0-9 &-]+$")]
PositivePaise = Annotated[int, Field(gt=0)]
NonEmpty = Annotated[str, Field(min_length=1)]


class Instrument(Contract):
    symbol: NonEmpty
    name: NonEmpty
    exchange: Exchange
    segment: Segment
    sector: NonEmpty
    indices: list[IndexName]
    last_close_paise: PositivePaise
    high52w_paise: PositivePaise = Field(alias="high52wPaise")
    low52w_paise: PositivePaise = Field(alias="low52wPaise")
    change_percent: float
    avg_daily_volume: Annotated[int, Field(ge=0)]
    lot_size: PositivePaise | None
    timeframes: Annotated[list[Timeframe], Field(min_length=1)]
    data_from: IsoDate
    data_to: IsoDate

    @model_validator(mode="after")
    def _rules(self) -> Self:
        if len(set(self.timeframes)) != len(self.timeframes):
            raise ValueError("timeframes must be unique")
        if self.data_from > self.data_to:
            raise ValueError("dataFrom must be on or before dataTo")
        if len(set(self.indices)) != len(self.indices):
            raise ValueError("indices must be unique")
        if not self.low52w_paise <= self.last_close_paise <= self.high52w_paise:
            raise ValueError("lastClosePaise must be between low52wPaise and high52wPaise")
        return self


class Candle(Contract):
    """`time` is a `YYYY-MM-DD` date for daily bars and a UTC datetime for intraday bars (D17)."""

    time: IsoDate | UtcDateTime
    open_paise: PositivePaise
    high_paise: PositivePaise
    low_paise: PositivePaise
    close_paise: PositivePaise
    volume: Annotated[int, Field(ge=0)]

    @model_validator(mode="after")
    def _ohlc(self) -> Self:
        if self.high_paise < max(self.open_paise, self.close_paise):
            raise ValueError("highPaise must be at least open and close")
        if self.low_paise > min(self.open_paise, self.close_paise):
            raise ValueError("lowPaise must be at most open and close")
        return self


class MarketIndex(Contract):
    """An NSE index (D56): `members` stocks of the list belong to it."""

    name: IndexName
    kite_symbol: NonEmpty
    members: Annotated[int, Field(ge=0)]
    updated_at: UtcDateTime | None
