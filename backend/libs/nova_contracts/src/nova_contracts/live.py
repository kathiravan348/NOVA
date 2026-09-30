"""Live equities (D74): mirror the Zod contracts in live.ts."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, IsoDate, UtcDateTime

MAX_LIVE_SYMBOLS = 500
LiveSymbol = Annotated[
    str, Field(min_length=1, max_length=80, pattern=r"^[A-Z0-9&]+(?:-[A-Z0-9&]+)*$")
]
Count = Annotated[int, Field(ge=0)]
SessionSeconds = Annotated[int, Field(ge=0, le=22_500)]
Price = Annotated[int, Field(gt=0)]


class LiveSubscribe(Contract):
    type: Literal["live.subscribe"]
    symbols: Annotated[list[LiveSymbol], Field(max_length=MAX_LIVE_SYMBOLS)]

    @model_validator(mode="after")
    def _unique(self) -> Self:
        if len(set(self.symbols)) != len(self.symbols):
            raise ValueError("symbols must be unique")
        return self


class LiveTick(Contract):
    symbol: LiveSymbol
    price: Price
    change_percent: float | None
    at: UtcDateTime
    ticks_this_second: Annotated[int, Field(gt=0)]


class LiveSnapshotItem(Contract):
    symbol: LiveSymbol
    price: Price | None
    change_percent: float | None
    at: UtcDateTime | None
    seconds_with_tick: Count
    seconds_expected: SessionSeconds

    @model_validator(mode="after")
    def _rules(self) -> Self:
        if self.seconds_with_tick > self.seconds_expected:
            raise ValueError("seconds exceed the session")
        if (self.price is None) != (self.at is None):
            raise ValueError("price and at must agree")
        return self


class LiveDaySummary(Contract):
    symbol: LiveSymbol
    day: IsoDate
    tick_count: Count
    candle_count: Count
    seconds_expected: SessionSeconds
    missing_seconds: Count
    no_trade_seconds: Count
    size_bytes: Count

    @model_validator(mode="after")
    def _rules(self) -> Self:
        if (
            self.candle_count + self.missing_seconds + self.no_trade_seconds
            != self.seconds_expected
        ):
            raise ValueError("second counts must equal secondsExpected")
        if self.candle_count > self.tick_count:
            raise ValueError("candles exceed ticks")
        return self
