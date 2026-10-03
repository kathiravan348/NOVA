"""Daily tick summaries for Recorded data history (D80).

After each session the worker stores, per recorded day, one `tick_sessions` row (stocks, ticks and
`feed_gap_seconds`: session seconds in which no stock had a tick) and one `tick_days` row per stock
with ticks. `GET /live/stocks` then reads only these small tables.
"""

import logging
from datetime import UTC, date, datetime, time, timedelta
from itertools import pairwise
from pathlib import Path

import pyarrow.parquet as pq
from nova_db.models import TickDay, TickSession
from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from nova_atlas.live_storage import IST, SESSION_SECONDS, midnight

logger = logging.getLogger("nova.atlas.live_summary")

# Today is summarized only after the recorder has stopped (15:30 IST) and flushed.
SUMMARY_AFTER = time(15, 35)

_STOCKS = text("""
    SELECT symbol, count(*) AS ticks, sum(pg_column_size(t)) AS bytes,
           count(DISTINCT date_trunc('second', received_at))
             FILTER (WHERE received_at >= :open AND received_at < :close) AS seconds
    FROM ticks t WHERE exchange = 'NSE' AND received_at >= :start AND received_at < :end
    GROUP BY symbol
""")
_ACTIVE = text("""
    SELECT DISTINCT date_trunc('second', received_at) AS second FROM ticks
    WHERE exchange = 'NSE' AND received_at >= :open AND received_at < :close
""")
# One TimescaleDB chunk per UTC day; the 09:15–15:30 IST session lies inside one UTC day.
_CHUNK_DAYS = text("""
    SELECT DISTINCT range_start::date AS day FROM timescaledb_information.chunks
    WHERE hypertable_name = 'ticks'
""")


def _archived_days(root: Path) -> set[date]:
    days = set()
    for directory in root.glob("date=*"):
        try:
            day = date.fromisoformat(directory.name.removeprefix("date="))
        except ValueError:
            continue
        if any(directory.glob("symbol=*/ticks.parquet")):
            days.add(day)
    return days


def pending_days(db: Session, root: Path, now: datetime) -> list[date]:
    """Weekdays with stored ticks and no complete summary, oldest first; today after 15:35 IST.

    A summary without `longest_feed_gap_seconds` (written before migration 0031) is rebuilt
    once, but only while the day's ticks are stored: rebuilding from nothing erases its counts.

    Cheap enough to run every minute: it lists chunks and folders, never scans tick rows.
    """
    local = now.astimezone(IST)
    candidates = set(db.scalars(_CHUNK_DAYS)) | _archived_days(root)
    done = set(
        db.scalars(select(TickSession.day).where(TickSession.longest_feed_gap_seconds.is_not(None)))
    )
    return sorted(
        day
        for day in candidates - done
        if day.weekday() < 5
        and (day < local.date() or (day == local.date() and local.time() >= SUMMARY_AFTER))
    )


def summarize_day(db: Session, root: Path, day: date, now: datetime) -> TickSession:
    """Replaces the day's summaries in one commit; safe to run again."""
    open_ = datetime.combine(day, time(9, 15), IST).astimezone(UTC)
    close = open_ + timedelta(seconds=SESSION_SECONDS)
    params = {
        "start": midnight(day),
        "end": midnight(day + timedelta(days=1)),
        "open": open_,
        "close": close,
    }
    rows: dict[str, tuple[int, int, int]] = {
        row.symbol: (row.ticks, row.bytes or 0, row.seconds) for row in db.execute(_STOCKS, params)
    }
    active = {int(row.second.timestamp()) for row in db.execute(_ACTIVE, params)}
    first, last = int(open_.timestamp()), int(close.timestamp())
    for path in (root / f"date={day.isoformat()}").glob("symbol=*/ticks.parquet"):
        symbol = path.parent.name.removeprefix("symbol=")
        if symbol in rows:  # the database copy wins while both exist
            continue
        archive = pq.ParquetFile(path)
        seconds: set[int] = set()
        for batch in archive.iter_batches(batch_size=32_768, columns=["exchange", "received_at"]):
            for exchange, at in zip(*(col.to_pylist() for col in batch.columns), strict=True):
                second = int(at.timestamp())
                if exchange == "NSE" and first <= second < last:
                    seconds.add(second)
        active |= seconds
        if archive.metadata.num_rows:
            rows[symbol] = (archive.metadata.num_rows, path.stat().st_size, len(seconds))

    db.execute(delete(TickDay).where(TickDay.day == day))
    if rows:
        db.execute(
            insert(TickDay),
            [
                {
                    "exchange": "NSE",
                    "symbol": symbol,
                    "day": day,
                    "ticks": ticks,
                    "size_bytes": size,
                    "seconds_with_tick": seconds,
                }
                for symbol, (ticks, size, seconds) in rows.items()
            ],
        )
    boundaries = [first - 1, *sorted(active), last]
    longest_gap = max(right - left - 1 for left, right in pairwise(boundaries)) if rows else 0
    values = {
        "longest_feed_gap_seconds": longest_gap,
        "stocks": len(rows),
        "ticks": sum(ticks for ticks, _, _ in rows.values()),
        "feed_gap_seconds": SESSION_SECONDS - len(active) if rows else 0,
        "summarized_at": now,
    }
    db.execute(
        insert(TickSession)
        .values(day=day, **values)
        .on_conflict_do_update(index_elements=["day"], set_=values)
    )
    db.commit()
    return db.get(TickSession, day) or TickSession(day=day, **values)


def summarize_next(db: Session, root: Path, now: datetime) -> date | None:
    """Summarizes the oldest pending day, if any (the worker calls this once a minute)."""
    days = pending_days(db, root, now)
    if not days:
        return None
    summary = summarize_day(db, root, days[0], now)
    logger.info(
        "Summarized %s: %s stocks, %s ticks, %s feed-gap seconds",
        days[0],
        summary.stocks,
        summary.ticks,
        summary.feed_gap_seconds,
    )
    return days[0]
