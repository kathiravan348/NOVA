"""Live snapshot and recorded-day summaries; no broker/Kite calls (D35, D74)."""

from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Query, Request
from nova_common import ApiException
from nova_common.internal import CallerDep
from nova_contracts.live import LiveDaySummary, LiveSnapshotItem, LiveSubscribe, LiveSymbol
from nova_db.models import Candle, UniverseEntry
from nova_db.web import Db
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select

from nova_atlas.live_storage import (
    IST,
    day_data,
    latest_ticks,
    midnight,
    recorded_days,
    snapshot_seconds,
)

router = APIRouter(prefix="/live")
SYMBOL = TypeAdapter(LiveSymbol)


def clock() -> datetime:
    return datetime.now(UTC)


def check_symbols(db: Db, symbols: list[str]) -> None:
    known = set(
        db.scalars(
            select(UniverseEntry.symbol).where(
                UniverseEntry.exchange == "NSE", UniverseEntry.symbol.in_(symbols)
            )
        )
    )
    if missing := sorted(set(symbols) - known):
        raise ApiException(404, "not_found", f"Unknown NSE stocks: {', '.join(missing)}")


def _change(price: int | None, previous: int | None) -> float | None:
    if price is None or not previous:
        return None
    return float(
        ((Decimal(price) - Decimal(previous)) * 100 / Decimal(previous)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    )


@router.get("/snapshot", response_model=list[LiveSnapshotItem])
def snapshot(
    request: Request,
    _: CallerDep,
    db: Db,
    symbols: Annotated[str, Query(min_length=1, max_length=40_500)],
) -> list[LiveSnapshotItem]:
    try:
        selected = LiveSubscribe(type="live.subscribe", symbols=symbols.split(",")).symbols
    except ValidationError as exc:
        raise ApiException(400, "invalid_request", "Choose 1–500 unique NSE stock symbols") from exc
    check_symbols(db, selected)
    now = clock()
    root = request.app.state.settings.archive_dir
    latest = latest_ticks(db, root, selected, now)
    counts, expected = snapshot_seconds(db, root, selected, now)
    # Last stored official close before each tick's IST date, not today's completed candle.
    by_day: dict[date, list[str]] = {}
    for symbol, stored in latest.items():
        if stored.at is not None:
            by_day.setdefault(stored.at.astimezone(IST).date(), []).append(symbol)
    closes: dict[str, int] = {}
    for day, stocks in by_day.items():
        query = (
            select(Candle.symbol, Candle.close_paise)
            .where(
                Candle.exchange == "NSE",
                Candle.symbol.in_(stocks),
                Candle.timeframe == "1d",
                Candle.ts < midnight(day),
            )
            .distinct(Candle.symbol)
            .order_by(Candle.symbol, Candle.ts.desc())
        )
        closes.update({symbol: price for symbol, price in db.execute(query).tuples()})
    result = []
    for symbol in selected:
        tick = latest.get(symbol)
        at, price = (tick.at, tick.price) if tick else (None, None)
        result.append(
            LiveSnapshotItem(
                symbol=symbol,
                price=price,
                change_percent=_change(price, closes.get(symbol)),
                at=at,
                seconds_with_tick=counts.get(symbol, 0),
                seconds_expected=expected,
            )
        )
    return result


@router.get("/days", response_model=list[LiveDaySummary])
def days(
    request: Request,
    _: CallerDep,
    db: Db,
    symbol: Annotated[str, Query(min_length=1, max_length=80)],
) -> list[LiveDaySummary]:
    try:
        SYMBOL.validate_python(symbol)
    except ValidationError as exc:
        raise ApiException(400, "invalid_request", "Choose an NSE stock symbol") from exc
    check_symbols(db, [symbol])
    now = clock()
    root = request.app.state.settings.archive_dir
    result = []
    for day in recorded_days(db, root, now):
        own, active, expected = day_data(db, root, day, [symbol], now)
        stock = own[symbol]
        faults = len(active - stock.seconds)
        result.append(
            LiveDaySummary(
                symbol=symbol,
                day=day,
                tick_count=stock.count,
                candle_count=len(stock.seconds),
                seconds_expected=expected,
                missing_seconds=faults,
                no_trade_seconds=expected - len(active),
                size_bytes=stock.size,
            )
        )
    return result
