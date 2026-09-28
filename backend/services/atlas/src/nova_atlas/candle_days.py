"""The per-day candle summary `candle_days` (D63): kept current by downloads and job deletes."""

from datetime import date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from nova_db.models import COVERAGE_TIMEFRAMES
from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Session
from sqlalchemy.types import Date

IST = ZoneInfo("Asia/Kolkata")


def calendar(db: Session, first: date, last: date) -> tuple[list[date], Literal["index", "stocks"]]:
    """Observed NSE sessions: union of NIFTY 50 and dates with at least ten daily stocks."""
    period = {"first": first, "last": last}
    index_days = db.scalars(
        text(
            "SELECT day FROM candle_days WHERE exchange = 'NSE' AND symbol = 'NIFTY 50'"
            " AND timeframe = '1d' AND day BETWEEN :first AND :last ORDER BY day"
        ),
        period,
    ).all()
    stock_days = db.scalars(
        text(
            "SELECT day FROM candle_days WHERE exchange = 'NSE' AND timeframe = '1d'"
            " AND symbol NOT IN (SELECT name FROM market_indices)"
            " AND day BETWEEN :first AND :last GROUP BY day HAVING count(*) >= 10 ORDER BY day"
        ),
        period,
    ).all()
    return sorted(set(index_days) | set(stock_days)), "index" if index_days else "stocks"


_MISSING = text(
    """
    WITH cal AS (SELECT unnest(:days) AS day), bounds AS (
        SELECT symbol, min(day) AS first, max(day) AS last FROM candle_days
        WHERE exchange = :exchange AND timeframe = :timeframe AND symbol IN :symbols
        GROUP BY symbol
    )
    SELECT b.symbol, count(*) FROM bounds b JOIN cal c ON c.day BETWEEN b.first AND b.last
    LEFT JOIN candle_days d ON d.exchange = :exchange AND d.timeframe = :timeframe
        AND d.symbol = b.symbol AND d.day = c.day
    WHERE d.day IS NULL GROUP BY b.symbol ORDER BY b.symbol
    """
).bindparams(bindparam("days", type_=ARRAY(Date())), bindparam("symbols", expanding=True))


def missing_download_days(
    db: Session, exchange: str, timeframe: str, symbols: list[str], first: date, last: date
) -> dict[str, int]:
    """Check internal gaps without inferring dates before listing or after delisting."""
    if exchange != "NSE" or not symbols:
        return {}
    days, _source = calendar(db, first, last)
    if not days:
        return {}
    return dict(
        db.execute(
            _MISSING,
            {"days": days, "exchange": exchange, "timeframe": timeframe, "symbols": symbols},
        )
        .tuples()
        .all()
    )


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
