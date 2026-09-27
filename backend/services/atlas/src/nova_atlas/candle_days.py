"""The per-day candle summary `candle_days` (D63): kept current by downloads and job deletes."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from nova_db.models import COVERAGE_TIMEFRAMES
from sqlalchemy import text
from sqlalchemy.orm import Session

IST = ZoneInfo("Asia/Kolkata")

_DELETE_DAYS = text(
    "DELETE FROM candle_days WHERE exchange = :exchange AND symbol = :symbol"
    " AND timeframe = :timeframe AND day BETWEEN :first AND :last"
)
_COUNT_DAYS = text(
    "INSERT INTO candle_days (exchange, symbol, timeframe, day, bars)"
    " SELECT exchange, symbol, timeframe, (ts AT TIME ZONE 'Asia/Kolkata')::date, count(*)"
    " FROM candles WHERE exchange = :exchange AND symbol = :symbol AND timeframe = :timeframe"
    " AND ts >= :start AND ts < :end GROUP BY 1, 2, 3, 4"
)


def ist_midnight(day: date) -> datetime:
    return datetime.combine(day, time(0, 0), tzinfo=IST)


def recount_days(
    db: Session, exchange: str, symbol: str, timeframe: str, start: datetime, end: datetime
) -> None:
    """Recounts every IST day that [start, end] touches, in the caller's transaction."""
    if timeframe not in COVERAGE_TIMEFRAMES:
        return
    first, last = start.astimezone(IST).date(), end.astimezone(IST).date()
    params = {"exchange": exchange, "symbol": symbol, "timeframe": timeframe}
    db.execute(_DELETE_DAYS, params | {"first": first, "last": last})
    window = {"start": ist_midnight(first), "end": ist_midnight(last + timedelta(days=1))}
    db.execute(_COUNT_DAYS, params | window)
