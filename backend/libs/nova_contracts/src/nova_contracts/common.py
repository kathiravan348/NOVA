"""Shared wire types, matching `frontend/packages/contracts/src/common.ts` and D17."""

import re
from datetime import UTC, date, datetime
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
)
from pydantic.alias_generators import to_camel

_ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


class Contract(BaseModel):
    """Base for every wire model: camelCase on the wire, no extra fields, no type coercion."""

    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        frozen=True,
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
    )


def _parse_utc_string(value: object) -> object:
    # Strict mode never coerces str -> datetime, so wire strings are parsed here (D17: UTC, "Z").
    if not isinstance(value, str):
        return value
    if not value.endswith("Z"):
        raise ValueError("timestamp must be UTC and end with 'Z'")
    return datetime.fromisoformat(value)


def _parse_iso_date(value: object) -> object:
    # Strict mode never coerces str -> date (request bodies are validated in Python mode).
    if not isinstance(value, str):
        return value
    if not _ISO_DATE.fullmatch(value):
        raise ValueError("date must be YYYY-MM-DD")
    return date.fromisoformat(value)


def _to_utc(value: datetime) -> datetime:
    return value.astimezone(UTC)


def _format_utc(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


Id = Annotated[str, Field(min_length=1)]
Email = Annotated[str, Field(pattern=r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")]
UtcDateTime = Annotated[
    AwareDatetime,
    BeforeValidator(_parse_utc_string),
    AfterValidator(_to_utc),
    PlainSerializer(_format_utc, return_type=str, when_used="json"),
]
IsoDate = Annotated[date, BeforeValidator(_parse_iso_date)]
Paise = int
NonNegPaise = Annotated[int, Field(ge=0)]

Segment = Literal["equity_delivery", "equity_intraday", "futures", "options"]
Exchange = Literal["NSE", "NFO"]
Timeframe = Literal["1m", "3m", "5m", "15m", "30m", "1h", "1d"]
Side = Literal["buy", "sell"]
