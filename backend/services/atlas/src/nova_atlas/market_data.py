"""`GET /market-data/instruments` and `GET /market-data/candles` (D11, D17, D32)."""

import time as time_module
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated, Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import CallerDep
from nova_contracts import Candle as CandleContract
from nova_contracts import Instrument as InstrumentContract
from nova_contracts import InstrumentCoverage
from nova_db.enums import TIMEFRAMES
from nova_db.models import Candle, Instrument
from nova_db.web import Db
from sqlalchemy import select, text

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
_COVERAGE = text(
    "SELECT symbol, timeframe, min(ts) AS first_ts, max(ts) AS last_ts FROM candles"
    " WHERE exchange = :exchange GROUP BY symbol, timeframe"
)
# The same statistics from intraday bars rolled up per IST day, for stocks without daily bars.
_INTRADAY_STATS = text(
    """
    WITH days AS (
        SELECT symbol, (ts AT TIME ZONE 'Asia/Kolkata')::date AS day,
               max(high_paise) AS high_paise, min(low_paise) AS low_paise, sum(volume) AS volume,
               last(close_paise, ts) AS close_paise
        FROM candles
        WHERE exchange = :exchange AND timeframe = :timeframe AND symbol = ANY(:symbols)
          AND ts >= :since
        GROUP BY symbol, day
    ), ranked AS (
        SELECT *, row_number() OVER (PARTITION BY symbol ORDER BY day DESC) AS rn,
               max(day) OVER (PARTITION BY symbol) AS last_day
        FROM days
    )
    SELECT symbol,
           max(close_paise) FILTER (WHERE rn = 1) AS last_close,
           max(close_paise) FILTER (WHERE rn = 2) AS prev_close,
           max(high_paise) FILTER (WHERE day > last_day - 365) AS high_52w,
           min(low_paise) FILTER (WHERE day > last_day - 365) AS low_52w,
           avg(volume) FILTER (WHERE rn <= 20) AS avg_volume
    FROM ranked
    GROUP BY symbol
    """
)
# Finest first: the roll-up reads one intraday timeframe per stock.
INTRADAY = ("1m", "3m", "5m", "15m", "30m", "1h")
# A roll-up covers the last year and 20 trading days, with room for holidays.
ROLL_UP_DAYS = 400
# Download jobs finishing or being deleted change this; the list is rebuilt only then.
_SIGNATURE = text(
    "SELECT count(*), max(finished_at) FROM data_jobs"
    " WHERE type = 'historical_download' AND status = 'completed'"
)


def _ist_date(moment: datetime) -> date:
    return moment.astimezone(IST).date()


def _change_percent(last: int, previous: int | None) -> float:
    if not previous:
        return 0.0
    change = (Decimal(last) - Decimal(previous)) * 100 / Decimal(previous)
    return float(change.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _intraday_stats(
    db: Db, exchange: str, coverage: dict[str, dict[str, tuple[datetime, datetime]]], skip: set[str]
) -> dict[str, Any]:
    """Statistics for stocks without daily bars, from their finest intraday timeframe."""
    by_timeframe: dict[str, list[str]] = {}
    for symbol, ranges in coverage.items():
        if symbol in skip:
            continue
        finest = next((t for t in INTRADAY if t in ranges), None)
        if finest is not None:
            by_timeframe.setdefault(finest, []).append(symbol)
    stats: dict[str, Any] = {}
    for timeframe, symbols in by_timeframe.items():
        newest = max(coverage[s][timeframe][1] for s in symbols)
        params = {
            "exchange": exchange,
            "timeframe": timeframe,
            "symbols": symbols,
            "since": newest - timedelta(days=ROLL_UP_DAYS),
        }
        stats.update((row.symbol, row) for row in db.execute(_INTRADAY_STATS, params))
    return stats


def build_instruments(db: Db, exchange: str) -> list[dict[str, Any]]:
    """Every stock with candles in any timeframe (NOVA-097). Any: JSON bodies."""
    coverage: dict[str, dict[str, tuple[datetime, datetime]]] = {}
    for row in db.execute(_COVERAGE, {"exchange": exchange}):
        coverage.setdefault(row.symbol, {})[row.timeframe] = (row.first_ts, row.last_ts)
    stats: dict[str, Any] = {
        row.symbol: row for row in db.execute(_DAILY_STATS, {"exchange": exchange})
    }
    stats.update(_intraday_stats(db, exchange, coverage, skip=set(stats)))

    body = []
    query = select(Instrument).where(Instrument.exchange == exchange).order_by(Instrument.symbol)
    for instrument in db.scalars(query):
        daily = stats.get(instrument.symbol)
        ranges = coverage.get(instrument.symbol, {})
        if daily is None or not ranges:
            continue  # no candles yet: nothing to show or test
        timeframes = [t for t in TIMEFRAMES if t in ranges]
        spans = [(t, _ist_date(ranges[t][0]), _ist_date(ranges[t][1])) for t in timeframes]
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
                "timeframes": timeframes,
                "data_from": min(first for _, first, _ in spans),
                "data_to": max(last for _, _, last in spans),
                "coverage": [
                    InstrumentCoverage.model_validate({"timeframe": t, "from": first, "to": last})
                    for t, first, last in spans
                ],
            }
        )
        body.append(contract.model_dump(mode="json"))
    return body


@dataclass
class _Cached:
    signature: tuple[object, ...]
    at: float
    body: list[dict[str, Any]]


@router.get("/instruments")
def list_instruments(request: Request, _: CallerDep, db: Db, exchange: str = "NSE") -> JSONResponse:
    """Rebuilt when a download finishes or is deleted, or after `instruments_cache_seconds`."""
    ttl: float = request.app.state.settings.instruments_cache_seconds
    cache: dict[str, _Cached] = request.app.state.instruments_cache
    signature = tuple(db.execute(_SIGNATURE).one())
    hit = cache.get(exchange)
    now = time_module.monotonic()
    if hit is None or hit.signature != signature or now - hit.at >= ttl:
        hit = _Cached(signature, now, build_instruments(db, exchange))
        cache[exchange] = hit
    return JSONResponse(hit.body)


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
