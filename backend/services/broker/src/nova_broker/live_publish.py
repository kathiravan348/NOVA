"""Best-effort live fan-out after tick storage commits (D74). Redis never gates recording."""

import logging
from datetime import UTC, datetime, time
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from zoneinfo import ZoneInfo

from nova_contracts.live import LiveTick
from nova_db.models import Candle
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.orm import Session

CHANNEL = "nova:ticks"
log = logging.getLogger(__name__)


def previous_closes(db: Session, symbols: list[str], now: datetime) -> dict[str, int]:
    start = datetime.combine(
        now.astimezone(ZoneInfo("Asia/Kolkata")).date(), time(), ZoneInfo("Asia/Kolkata")
    ).astimezone(UTC)
    query = (
        select(Candle.symbol, Candle.close_paise)
        .where(
            Candle.exchange == "NSE",
            Candle.symbol.in_(symbols),
            Candle.timeframe == "1d",
            Candle.ts < start,
        )
        .distinct(Candle.symbol)
        .order_by(Candle.symbol, Candle.ts.desc())
    )
    return {symbol: price for symbol, price in db.execute(query).tuples()}


def change_percent(price: int, previous: int | None) -> float | None:
    if not previous:
        return None
    value = (Decimal(price) - Decimal(previous)) * 100 / Decimal(previous)
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def publish_ticks(redis: Redis, rows: list[dict[str, Any]], closes: dict[str, int]) -> None:
    # Any: recorder rows contain heterogeneous SQL column values.
    try:
        with redis.pipeline(transaction=False) as pipe:
            for row in rows:
                tick = LiveTick(
                    symbol=row["symbol"],
                    price=row["last_price_paise"],
                    change_percent=change_percent(
                        row["last_price_paise"], closes.get(row["symbol"])
                    ),
                    at=row["received_at"],
                    ticks_this_second=1,
                )
                pipe.publish(CHANNEL, tick.model_dump_json())
            pipe.execute()
    except RedisError:
        log.warning("Live tick delivery unavailable; ticks remain stored")
