"""`GET /market-data/instruments` and `GET /market-data/candles` (D11, D17, D32)."""

from datetime import UTC, date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated, Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_contracts import Candle as CandleContract
from nova_contracts import Instrument as InstrumentContract
from nova_db.enums import TIMEFRAMES
from nova_db.models import Candle, Instrument
from nova_db.web import Db
from sqlalchemy import select, text

from nova_atlas.jobs import CallerDep

router = APIRouter(prefix="/market-data")

IST = ZoneInfo("Asia/Kolkata")
DEFAULT_DAYS = {"1d": 365}
DEFAULT_INTRADAY_DAYS = 5
MAX_DAYS = {"1d": 3660}
MAX_INTRADAY_DAYS = 60

# One pass over each symbol's daily bars: latest closes, 52-week range, 20-bar volume, coverage.
_DAILY_STATS = text(
    """
    WITH daily AS (
        SELECT symbol, ts, high_paise, low_paise, close_paise, volume,
               row_number() OVER (PARTITION BY symbol ORDER BY ts DESC) AS rn,
               max(ts) OVER (PARTITION BY symbol) AS last_ts
        FROM candles
        WHERE exchange = :exchange AND timeframe = '1d'
    )
    SELECT symbol,
           max(close_paise) FILTER (WHERE rn = 1) AS last_close,
           max(close_paise) FILTER (WHERE rn = 2) AS prev_close,
           max(high_paise) FILTER (WHERE ts > last_ts - interval '365 days') AS high_52w,
           min(low_paise) FILTER (WHERE ts > last_ts - interval '365 days') AS low_52w,
           avg(volume) FILTER (WHERE rn <= 20) AS avg_volume,
           min(ts) AS first_ts,
           max(ts) AS last_ts
    FROM daily
    GROUP BY symbol
    """
)
_TIMEFRAMES = text("SELECT DISTINCT symbol, timeframe FROM candles WHERE exchange = :exchange")


def _ist_date(moment: datetime) -> date:
    return moment.astimezone(IST).date()


def _change_percent(last: int, previous: int | None) -> float:
    if not previous:
        return 0.0
    change = (Decimal(last) - Decimal(previous)) * 100 / Decimal(previous)
    return float(change.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


@router.get("/instruments")
def list_instruments(_: CallerDep, db: Db, exchange: str = "NSE") -> JSONResponse:
    stats: dict[str, Any] = {
        row.symbol: row for row in db.execute(_DAILY_STATS, {"exchange": exchange})
    }
    timeframes: dict[str, set[str]] = {}
    for symbol, timeframe in db.execute(_TIMEFRAMES, {"exchange": exchange}).tuples():
        timeframes.setdefault(symbol, set()).add(timeframe)

    body = []
    query = select(Instrument).where(Instrument.exchange == exchange).order_by(Instrument.symbol)
    for instrument in db.scalars(query):
        daily = stats.get(instrument.symbol)
        if daily is None:
            continue  # no daily bars yet: nothing to show as a last close
        contract = InstrumentContract.model_validate(
            {
                "symbol": instrument.symbol,
                "name": instrument.name,
                "exchange": instrument.exchange,
                "segment": instrument.segment,
                "sector": instrument.sector,
                "indices": instrument.indices,
                "last_close_paise": daily.last_close,
                "high52w_paise": daily.high_52w,
                "low52w_paise": daily.low_52w,
                "change_percent": _change_percent(daily.last_close, daily.prev_close),
                "avg_daily_volume": int(daily.avg_volume),
                "lot_size": instrument.lot_size,
                "timeframes": [t for t in TIMEFRAMES if t in timeframes.get(instrument.symbol, ())],
                "data_from": _ist_date(daily.first_ts),
                "data_to": _ist_date(daily.last_ts),
            }
        )
        body.append(contract.model_dump(mode="json"))
    return JSONResponse(body)


def _window(
    db: Db, exchange: str, symbol: str, timeframe: str, first: date | None, last: date | None
) -> tuple[datetime, datetime] | None:
    """The UTC range to read, or None when the symbol has no bars in this timeframe."""
    daily = timeframe == "1d"
    if last is None:
        newest = db.scalar(
            select(Candle.ts)
            .where(
                Candle.exchange == exchange, Candle.symbol == symbol, Candle.timeframe == timeframe
            )
            .order_by(Candle.ts.desc())
            .limit(1)
        )
        if newest is None:
            return None
        last = _ist_date(newest)
    if first is None:
        first = last - timedelta(days=(DEFAULT_DAYS["1d"] if daily else DEFAULT_INTRADAY_DAYS) - 1)
    if first > last:
        raise ApiException(400, "invalid_request", "from must be on or before to")
    longest = MAX_DAYS["1d"] if daily else MAX_INTRADAY_DAYS
    if (last - first).days + 1 > longest:
        raise ApiException(
            400, "invalid_request", f"At most {longest} days per request for {timeframe}"
        )
    start = datetime.combine(first, time(0, 0), tzinfo=IST).astimezone(UTC)
    end = datetime.combine(last + timedelta(days=1), time(0, 0), tzinfo=IST).astimezone(UTC)
    return start, end


@router.get("/candles")
def list_candles(
    _: CallerDep,
    db: Db,
    symbol: Annotated[str, Query(min_length=1)],
    timeframe: str,
    first: Annotated[date | None, Query(alias="from")] = None,
    last: Annotated[date | None, Query(alias="to")] = None,
    exchange: str = "NSE",
) -> JSONResponse:
    if timeframe not in TIMEFRAMES:
        raise ApiException(
            400, "invalid_request", f"timeframe must be one of {', '.join(TIMEFRAMES)}"
        )
    if db.get(Instrument, (exchange, symbol)) is None:
        raise ApiException(404, "not_found", f"No market data for {symbol}")
    window = _window(db, exchange, symbol, timeframe, first, last)
    if window is None:
        return JSONResponse([])
    bars = db.scalars(
        select(Candle)
        .where(
            Candle.exchange == exchange,
            Candle.symbol == symbol,
            Candle.timeframe == timeframe,
            Candle.ts >= window[0],
            Candle.ts < window[1],
        )
        .order_by(Candle.ts)
    )
    body = [
        CandleContract.model_validate(
            {
                "time": _ist_date(bar.ts) if timeframe == "1d" else bar.ts,
                "open_paise": bar.open_paise,
                "high_paise": bar.high_paise,
                "low_paise": bar.low_paise,
                "close_paise": bar.close_paise,
                "volume": bar.volume,
            }
        ).model_dump(mode="json")
        for bar in bars
    ]
    return JSONResponse(body)
