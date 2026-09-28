"""Stored data (D63): the per-day summary, the trading calendar and the coverage endpoints."""

from bisect import bisect_left, bisect_right
from dataclasses import dataclass
from datetime import date, datetime
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import CallerDep
from nova_contracts import CoverageDetail, CoverageList, CoverageRow, MissingRange
from nova_db.models import MarketIndex
from nova_db.web import Db
from sqlalchemy import bindparam, select, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Session
from sqlalchemy.types import Date

from nova_atlas.candle_days import calendar
from nova_atlas.universe import load_universe

router = APIRouter(prefix="/market-data")

IST = ZoneInfo("Asia/Kolkata")
EXCHANGE = "NSE"
DEFAULT_FROM = date(2020, 1, 1)  # D69: where stored history starts by default


_SERIES = text(
    """
    WITH cal AS (SELECT unnest(:cal) AS day)
    SELECT d.symbol, min(d.day), max(d.day),
           count(*) FILTER (WHERE d.day BETWEEN :first AND :last),
           count(c.day) FILTER (WHERE d.day BETWEEN :first AND :last)
    FROM candle_days d LEFT JOIN cal c ON c.day = d.day
    WHERE d.exchange = :exchange AND d.timeframe = :timeframe
    GROUP BY d.symbol
    """
).bindparams(bindparam("cal", type_=ARRAY(Date())))


_ASKED_FROM = text(
    """
    SELECT s.symbol, min(s.start_at)
    FROM data_job_steps s JOIN data_jobs j ON j.id = s.job_id
    WHERE j.exchange = :exchange AND j.timeframe = :timeframe AND s.status = 'done'
    GROUP BY s.symbol
    """
)


@dataclass(frozen=True)
class _Series:
    first_day: date
    last_day: date
    days: int  # stored days inside the period
    on_calendar: int  # of those, days that are trading days
    asked_from: date | None = None  # earliest day a finished download step asked Kite for


@dataclass(frozen=True)
class _Numbers:
    first_day: date | None
    last_day: date | None
    days: int
    missing_days: int
    status: Literal["complete", "gaps", "partial", "none"]
    window: tuple[date, date] | None  # where missing days are counted


def _series(
    db: Session, timeframe: str, first: date, last: date, days: list[date]
) -> dict[str, _Series]:
    params = {
        "cal": days,
        "first": first,
        "last": last,
        "exchange": EXCHANGE,
        "timeframe": timeframe,
    }
    asked = {
        symbol: at.astimezone(IST).date()
        for symbol, at in db.execute(_ASKED_FROM, {"exchange": EXCHANGE, "timeframe": timeframe})
    }
    return {
        symbol: _Series(lo, hi, n, on_cal, asked.get(symbol))
        for symbol, lo, hi, n, on_cal in db.execute(_SERIES, params)
    }


def _listed_later(series: _Series, days: list[date]) -> bool:
    """Kite was asked for trading days before the first stored one and had none: it starts there."""
    if series.asked_from is None:
        return False
    return bisect_left(days, series.first_day) > bisect_left(days, series.asked_from)


def _numbers(series: _Series | None, first: date, last: date, days: list[date]) -> _Numbers:
    if series is None:
        return _Numbers(None, None, 0, 0, "none", None)
    if series.days == 0:
        return _Numbers(series.first_day, series.last_day, 0, 0, "none", None)
    lo, hi = max(series.first_day, first), min(series.last_day, last)
    expected = bisect_right(days, hi) - bisect_left(days, lo)
    missing = max(expected - series.on_calendar, 0)
    starts_late = bool(days) and series.first_day > days[0] and not _listed_later(series, days)
    ends_early = bool(days) and series.last_day < days[-1]
    status: Literal["complete", "gaps", "partial"] = (
        "gaps" if missing else "partial" if starts_late or ends_early else "complete"
    )
    return _Numbers(series.first_day, series.last_day, series.days, missing, status, (lo, hi))


def _period(first: date | None, last: date | None) -> tuple[date, date]:
    last = last or datetime.now(IST).date()
    if first is None:
        first = min(DEFAULT_FROM, last)
    if first > last:
        raise ApiException(400, "invalid_request", "From must be on or before To")
    return first, last


TimeframeQuery = Annotated[Literal["1m", "1d"], Query()]


@router.get("/coverage")
def list_coverage(
    _: CallerDep,
    db: Db,
    timeframe: TimeframeQuery = "1d",
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
) -> JSONResponse:
    """Every stock of the list and every index: stored range, missing days, status.

    Indices without candles are listed too (`none`), so Download missing can fetch them (D65).
    """
    first, last = _period(from_, to)
    days, source = calendar(db, first, last)
    series = _series(db, timeframe, first, last, days)
    rows: list[CoverageRow] = []
    for entry in load_universe(db):
        n = _numbers(series.get(entry.symbol), first, last, days)
        rows.append(_row(entry.symbol, entry.name, "stock", entry.sector, list(entry.indices), n))
    for name in db.scalars(select(MarketIndex.name).order_by(MarketIndex.name)):
        n = _numbers(series.get(name), first, last, days)
        rows.append(_row(name, name, "index", "Index", [], n))
    body = CoverageList.model_validate(
        {"timeframe": timeframe, "from": first, "to": last, "calendar": source, "rows": rows}
    )
    return JSONResponse(body.model_dump(mode="json"))


def _row(
    symbol: str, name: str, kind: str, sector: str, indices: list[str], n: _Numbers
) -> CoverageRow:
    return CoverageRow.model_validate(
        {
            "symbol": symbol,
            "name": name,
            "kind": kind,
            "sector": sector,
            "indices": indices,
            "first_day": n.first_day,
            "last_day": n.last_day,
            "days": n.days,
            "missing_days": n.missing_days,
            "status": n.status,
        }
    )


def missing_ranges(stored: set[date], days: list[date], lo: date, hi: date) -> list[MissingRange]:
    """Trading days in [lo, hi] with no bar, merged when they follow each other in the calendar."""
    ranges: list[list[date]] = []
    previous_missing = False
    for day in days[bisect_left(days, lo) : bisect_right(days, hi)]:
        if day in stored:
            previous_missing = False
            continue
        if previous_missing:
            ranges[-1].append(day)
        else:
            ranges.append([day])
        previous_missing = True
    return [
        MissingRange.model_validate({"from": r[0], "to": r[-1], "days": len(r)}) for r in ranges
    ]


@router.get("/coverage/{symbol}")
def coverage_detail(
    symbol: str,
    _: CallerDep,
    db: Db,
    timeframe: TimeframeQuery = "1d",
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
) -> JSONResponse:
    """One stock's (or index's) numbers and its missing date ranges."""
    first, last = _period(from_, to)
    known = {e.symbol for e in load_universe(db)} | set(db.scalars(select(MarketIndex.name)))
    if symbol not in known:
        raise ApiException(404, "not_found", f"{symbol} is not in the stock list")
    days, _source = calendar(db, first, last)
    n = _numbers(_series(db, timeframe, first, last, days).get(symbol), first, last, days)
    missing: list[MissingRange] = []
    if n.window is not None and n.missing_days:
        stored = set(
            db.scalars(
                text(
                    "SELECT day FROM candle_days WHERE exchange = :exchange AND symbol = :symbol"
                    " AND timeframe = :timeframe AND day BETWEEN :lo AND :hi"
                ),
                {
                    "exchange": EXCHANGE,
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "lo": n.window[0],
                    "hi": n.window[1],
                },
            )
        )
        missing = missing_ranges(stored, days, *n.window)
    body = CoverageDetail.model_validate(
        {
            "symbol": symbol,
            "timeframe": timeframe,
            "from": first,
            "to": last,
            "first_day": n.first_day,
            "last_day": n.last_day,
            "days": n.days,
            "missing_days": n.missing_days,
            "missing": missing,
        }
    )
    return JSONResponse(body.model_dump(mode="json"))
