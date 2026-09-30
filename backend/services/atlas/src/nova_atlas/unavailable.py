"""Successful broker checks, unavailable-day evidence and automatic recovery (D70)."""

from datetime import UTC, date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import CallerDep
from nova_contracts import PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX, Page
from nova_contracts.unavailable import UnavailableDay as DayContract
from nova_db import new_id
from nova_db.models import CandleDay, UnavailableDay
from nova_db.paging import newest_first
from nova_db.web import Db
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from nova_atlas.candle_days import IST, calendar

router = APIRouter(prefix="/market-data")


def tracked_dates(
    db: Session, exchange: str, symbol: str, timeframe: str, first: date, last: date
) -> list[date]:
    """Unresolved source gaps, excluding dates that actually have prices again."""
    stored = select(CandleDay.day).where(
        CandleDay.exchange == exchange,
        CandleDay.symbol == symbol,
        CandleDay.timeframe == timeframe,
    )
    return list(
        db.scalars(
            select(UnavailableDay.day).where(
                UnavailableDay.exchange == exchange,
                UnavailableDay.symbol == symbol,
                UnavailableDay.timeframe == timeframe,
                UnavailableDay.day.between(first, last),
                UnavailableDay.resolved_at.is_(None),
                UnavailableDay.day.not_in(stored),
            )
        )
    )


def unavailable_counts(db: Session, timeframe: str, first: date, last: date) -> dict[str, int]:
    stored = (
        select(CandleDay.day)
        .where(
            CandleDay.exchange == UnavailableDay.exchange,
            CandleDay.symbol == UnavailableDay.symbol,
            CandleDay.timeframe == UnavailableDay.timeframe,
            CandleDay.day == UnavailableDay.day,
        )
        .exists()
    )
    return dict(
        db.execute(
            select(UnavailableDay.symbol, func.count())
            .where(
                UnavailableDay.exchange == "NSE",
                UnavailableDay.timeframe == timeframe,
                UnavailableDay.day.between(first, last),
                UnavailableDay.resolved_at.is_(None),
                ~stored,
            )
            .group_by(UnavailableDay.symbol)
        )
        .tuples()
        .all()
    )


def record_check(
    db: Session,
    *,
    exchange: str,
    symbol: str,
    timeframe: str,
    first: date,
    last: date,
    check_id: str,
    job_id: str | None = None,
    at: datetime | None = None,
    only_new: bool = False,
) -> int:
    """Call only after a successful historical response and its candle writes, before commit.

    An empty API response is evidence, an HTTP/network error is not. The check id makes a
    committed job step idempotent. Known series bounds exclude pre-listing/post-history dates.
    """
    at = at or datetime.now(UTC)
    stored = list(
        db.scalars(
            select(CandleDay.day).where(
                CandleDay.exchange == exchange,
                CandleDay.symbol == symbol,
                CandleDay.timeframe == timeframe,
                CandleDay.day.between(first, last),
            )
        )
    )
    if stored and not only_new:
        db.execute(
            update(UnavailableDay)
            .where(
                UnavailableDay.exchange == exchange,
                UnavailableDay.symbol == symbol,
                UnavailableDay.timeframe == timeframe,
                UnavailableDay.day.in_(stored),
                UnavailableDay.last_check_id != check_id,
            )
            .values(
                resolved_at=func.coalesce(UnavailableDay.resolved_at, at),
                last_checked_at=at,
                last_job_id=job_id,
                last_check_id=check_id,
                attempts=UnavailableDay.attempts + 1,
            )
        )
    lo, hi = db.execute(
        select(func.min(CandleDay.day), func.max(CandleDay.day)).where(
            CandleDay.exchange == exchange,
            CandleDay.symbol == symbol,
            CandleDay.timeframe == timeframe,
        )
    ).one()
    if exchange != "NSE" or lo is None or hi is None:
        return 0
    days, _source = (
        calendar(db, max(first, lo), min(last, hi))
        if max(first, lo) <= min(last, hi)
        else ([], "index")
    )
    missing = sorted(set(days) - set(stored))
    if not missing:
        return 0
    statement = insert(UnavailableDay).values(
        [
            {
                "id": new_id("gap"),
                "exchange": exchange,
                "symbol": symbol,
                "timeframe": timeframe,
                "day": day,
                "broker": "Zerodha",
                "reason": "no_usable_candle",
                "first_checked_at": at,
                "last_checked_at": at,
                "attempts": 1,
                "last_job_id": job_id,
                "last_check_id": check_id,
                "resolved_at": None,
            }
            for day in missing
        ]
    )
    statement = (
        statement.on_conflict_do_nothing(index_elements=["exchange", "symbol", "timeframe", "day"])
        if only_new
        else statement.on_conflict_do_update(
            index_elements=["exchange", "symbol", "timeframe", "day"],
            set_={
                "last_checked_at": at,
                "attempts": UnavailableDay.attempts + 1,
                "last_job_id": job_id,
                "last_check_id": check_id,
                "resolved_at": None,
            },
            where=UnavailableDay.last_check_id != check_id,
        )
    )
    db.execute(statement)
    return len(missing)


def day_contract(row: UnavailableDay) -> DayContract:
    return DayContract.model_validate(
        {
            "id": row.id,
            "exchange": row.exchange,
            "symbol": row.symbol,
            "timeframe": row.timeframe,
            "day": row.day,
            "broker": row.broker,
            "reason": row.reason,
            "first_checked_at": row.first_checked_at,
            "last_checked_at": row.last_checked_at,
            "attempts": row.attempts,
            "last_job_id": row.last_job_id,
            "resolved_at": row.resolved_at,
            "status": "resolved" if row.resolved_at is not None else "unavailable",
        }
    )


@router.get("/unavailable")
def list_unavailable(
    _: CallerDep,
    db: Db,
    timeframe: Literal["1m", "1d"] = "1d",
    from_: Annotated[date, Query(alias="from")] = date(2020, 1, 1),
    to: date | None = None,
    status: Literal["unavailable", "resolved", "all"] = "unavailable",
    symbol: str | None = None,
    limit: Annotated[int, Query(ge=1, le=PAGE_LIMIT_MAX)] = PAGE_LIMIT_DEFAULT,
    cursor: Annotated[str | None, Query(min_length=1)] = None,
    offset: Annotated[int | None, Query(ge=0)] = None,
) -> JSONResponse:
    last = to or datetime.now(IST).date()
    if from_ > last:
        raise ApiException(400, "invalid_request", "From must be on or before To")
    where = [
        UnavailableDay.exchange == "NSE",
        UnavailableDay.timeframe == timeframe,
        UnavailableDay.day.between(from_, last),
    ]
    if symbol:
        where.append(UnavailableDay.symbol == symbol)
    if status != "all":
        where.append(
            UnavailableDay.resolved_at.is_(None)
            if status == "unavailable"
            else UnavailableDay.resolved_at.is_not(None)
        )
    rows, next_cursor, total = newest_first(
        db,
        UnavailableDay,
        UnavailableDay.first_checked_at,
        UnavailableDay.id,
        limit=limit,
        cursor=cursor,
        offset=offset,
        where=where,
    )
    return JSONResponse(
        Page[DayContract](
            items=[day_contract(row) for row in rows],
            next_cursor=next_cursor,
            total=total,
        ).model_dump(mode="json")
    )
