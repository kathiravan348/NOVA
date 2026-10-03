"""Daily Kite check of recorded ticks (D81 (4)).

After a day is summarized (D80) the worker compares 50 recorded stocks (the 10 busiest and 40 at
random) with Kite's 1-minute candles: the minute close, whether our high/low stay inside Kite's,
and the minute volume, all by exchange time. It also stores the median receive delay
(`received_at − exchange_ts`), which shows a wrong PC clock. One `tick_checks` row per day.
"""

import logging
import random
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from nova_contracts.live import TickCheck as TickCheckContract
from nova_contracts.live import TickCheckStock
from nova_db.models import TickCheck, TickDay, TickSession
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from nova_atlas.broker_client import BrokerData, BrokerDataError
from nova_atlas.download import to_paise
from nova_atlas.live_storage import IST
from nova_atlas.tokens import kite_tokens

logger = logging.getLogger("nova.atlas.live_check")

BUSIEST = 10
RANDOM = 40
MIN_TICKS = 200
CHECK_AFTER = time(16, 0)  # today's check waits for Kite's day to settle
MAX_AGE_DAYS = 10
RETRY_AFTER = timedelta(minutes=15)
FIRST_MINUTE = time(9, 16)  # 09:15 carries the opening auction's volume
SESSION_OPEN, SESSION_CLOSE = time(9, 15), time(15, 30)

_TICKS = text("""
    SELECT COALESCE(exchange_ts, received_at) AS at, last_price_paise, volume FROM ticks
    WHERE exchange = 'NSE' AND symbol = :symbol AND received_at >= :start AND received_at < :end
    ORDER BY at, received_at
""")
_OFFSET = text("""
    SELECT percentile_cont(0.5) WITHIN GROUP (
        ORDER BY extract(epoch FROM received_at - exchange_ts) * 1000
    ) FROM ticks
    WHERE exchange = 'NSE' AND symbol = ANY(:symbols) AND exchange_ts IS NOT NULL
      AND received_at >= :start AND received_at < :end
""")


@dataclass
class _Minute:
    close: int
    high: int
    low: int
    volume: int  # the day's running volume at the minute's last tick


@dataclass
class StockResult:
    symbol: str
    minutes: int = 0
    close_matches: int = 0
    range_ok: int = 0
    volume_minutes: int = 0
    volume_matches: int = 0

    def row(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "minutes": self.minutes,
            "closeMatches": self.close_matches,
            "rangeOk": self.range_ok,
            "volumeMinutes": self.volume_minutes,
            "volumeMatches": self.volume_matches,
        }


def sample(db: Session, day: date) -> list[str]:
    """10 busiest + 40 random stocks of the day (≥ 200 ticks, no iNAVs), same pick on a re-run."""
    rows = db.execute(
        select(TickDay.symbol, TickDay.ticks)
        .where(TickDay.exchange == "NSE", TickDay.day == day, TickDay.ticks >= MIN_TICKS)
        .order_by(TickDay.ticks.desc(), TickDay.symbol)
    ).all()
    symbols = [r.symbol for r in rows if not r.symbol.endswith("INAV")]
    busiest, rest = symbols[:BUSIEST], sorted(symbols[BUSIEST:])
    picked = random.Random(day.isoformat()).sample(rest, min(RANDOM, len(rest)))
    return busiest + sorted(picked)


def _minutes(db: Session, symbol: str, start: datetime, end: datetime) -> dict[datetime, _Minute]:
    out: dict[datetime, _Minute] = {}
    for at, price, volume in db.execute(_TICKS, {"symbol": symbol, "start": start, "end": end}):
        key = at.astimezone(IST).replace(second=0, microsecond=0)
        found = out.get(key)
        if found is None:
            out[key] = _Minute(price, price, price, volume)
        else:
            found.close, found.volume = price, volume
            found.high, found.low = max(found.high, price), min(found.low, price)
    return out


def compare(symbol: str, ours: dict[datetime, _Minute], kite: list[list[Any]]) -> StockResult:
    """Minutes from 09:16 to Kite's last candle that we also recorded."""
    result = StockResult(symbol)
    for candle in kite:
        at = datetime.fromisoformat(str(candle[0])).astimezone(IST).replace(second=0)
        mine = ours.get(at)
        if at.time() < FIRST_MINUTE or mine is None:
            continue
        high_k, low_k, close_k = (to_paise(v) for v in candle[2:5])
        volume = int(candle[5])
        result.minutes += 1
        result.close_matches += mine.close == close_k
        result.range_ok += mine.high <= high_k and mine.low >= low_k
        previous = ours.get(at - timedelta(minutes=1))
        if previous is not None:
            result.volume_minutes += 1
            result.volume_matches += mine.volume - previous.volume == volume
    return result


def check_day(db: Session, broker: BrokerData, day: date, now: datetime) -> TickCheck:
    """Checks one day and upserts its row; a `BrokerDataError` leaves nothing stored."""
    open_ = datetime.combine(day, SESSION_OPEN, IST)
    close = datetime.combine(day, SESSION_CLOSE, IST)
    start, end = open_ - timedelta(minutes=5), close + timedelta(minutes=5)
    symbols = sample(db, day)
    tokens = kite_tokens(db, "NSE", symbols)
    results: list[StockResult] = []
    skipped = 0
    for symbol in symbols:
        token = tokens.get(symbol)
        candles = broker.historical(token, "minute", open_, close) if token is not None else []
        if not candles:
            skipped += 1
            continue
        results.append(compare(symbol, _minutes(db, symbol, start, end), candles))
    offset = (
        db.scalar(_OFFSET, {"symbols": symbols, "start": start, "end": end}) if symbols else None
    )
    values = {
        "stocks_checked": len(results),
        "stocks_skipped": skipped,
        "minutes": sum(r.minutes for r in results),
        "close_matches": sum(r.close_matches for r in results),
        "range_ok": sum(r.range_ok for r in results),
        "volume_minutes": sum(r.volume_minutes for r in results),
        "volume_matches": sum(r.volume_matches for r in results),
        "clock_offset_ms": None if offset is None else round(float(offset)),
        "stocks": [r.row() for r in results],
        "checked_at": now,
    }
    db.execute(
        insert(TickCheck)
        .values(day=day, **values)
        .on_conflict_do_update(index_elements=["day"], set_=values)
    )
    db.commit()
    found = db.get(TickCheck, day)
    assert found is not None
    db.refresh(found)
    return found


@dataclass
class DailyCheck:
    """`check_next` for the worker: one day per call, waits 15 min after a broker error."""

    broker: BrokerData
    retry_at: datetime | None = field(default=None)

    def check_next(self, db: Session, now: datetime) -> date | None:
        if self.retry_at is not None and now < self.retry_at:
            return None
        day = next_day(db, now)
        if day is None:
            return None
        try:
            found = check_day(db, self.broker, day, now)
        except BrokerDataError as exc:
            db.rollback()
            self.retry_at = now + RETRY_AFTER
            logger.warning("Kite check of %s waits 15 min: %s", day, exc)
            return None
        self.retry_at = None
        logger.info(
            "Kite check %s: %s stocks, %s minutes, %s close matches",
            day,
            found.stocks_checked,
            found.minutes,
            found.close_matches,
        )
        return day


def next_day(db: Session, now: datetime) -> date | None:
    """Oldest summarized day of the last 10 without a check; today only from 16:00 IST."""
    local = now.astimezone(IST)
    oldest = local.date() - timedelta(days=MAX_AGE_DAYS)
    done = select(TickCheck.day)
    days = db.scalars(
        select(TickSession.day)
        .where(TickSession.day >= oldest, TickSession.day.not_in(done))
        .order_by(TickSession.day)
    )
    for day in days:
        if day < local.date() or (day == local.date() and local.time() >= CHECK_AFTER):
            return day
    return None


def _percent(part: int, whole: int) -> float | None:
    return round(part * 100 / whole, 1) if whole else None


def warnings(row: TickCheck) -> list[str]:
    out = []
    close = _percent(row.close_matches, row.minutes)
    in_range = _percent(row.range_ok, row.minutes)
    volume = _percent(row.volume_matches, row.volume_minutes)
    if close is not None and close < 95:
        out.append(f"Minute closes matched Kite for only {close} % of minutes (below 95 %)")
    if in_range is not None and in_range < 99:
        out.append(f"Only {in_range} % of minutes stayed inside Kite's high/low (below 99 %)")
    if volume is not None and volume < 95:
        out.append(f"Minute volumes matched Kite for only {volume} % of minutes (below 95 %)")
    if row.clock_offset_ms is not None and abs(row.clock_offset_ms) > 3000:
        seconds = round(abs(row.clock_offset_ms) / 1000)
        out.append(f"Receive times are {seconds} s off exchange times: sync the PC clock")
    if row.stocks_skipped > 10:
        out.append(f"{row.stocks_skipped} stocks had no Kite candles and were skipped")
    return out


def contract(row: TickCheck) -> TickCheckContract:
    return TickCheckContract(
        day=row.day,
        stocks_checked=row.stocks_checked,
        stocks_skipped=row.stocks_skipped,
        minutes=row.minutes,
        close_match_percent=_percent(row.close_matches, row.minutes),
        range_ok_percent=_percent(row.range_ok, row.minutes),
        volume_match_percent=_percent(row.volume_matches, row.volume_minutes),
        clock_offset_seconds=(
            None if row.clock_offset_ms is None else round(row.clock_offset_ms / 1000, 1)
        ),
        warnings=warnings(row),
        checked_at=row.checked_at.astimezone(UTC),
        stocks=[
            TickCheckStock(
                symbol=s["symbol"],
                minutes=s["minutes"],
                close_match_percent=_percent(s["closeMatches"], s["minutes"]),
                range_ok_percent=_percent(s["rangeOk"], s["minutes"]),
                volume_match_percent=_percent(s["volumeMatches"], s["volumeMinutes"]),
            )
            for s in row.stocks
        ],
    )
