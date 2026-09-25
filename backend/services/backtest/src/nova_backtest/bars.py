"""One OHLCV bar as the engine sees it: time in UTC, prices in integer paise (D17)."""

from dataclasses import dataclass
from datetime import date, datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


@dataclass(frozen=True)
class Bar:
    ts: datetime
    open: int
    high: int
    low: int
    close: int
    volume: int

    @property
    def ist_date(self) -> date:
        return self.ts.astimezone(IST).date()
