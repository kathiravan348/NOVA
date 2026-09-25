"""Old ticks → Parquet (D49): `archive/date=YYYY-MM-DD/symbol=SYM/ticks.parquet`, a day at a time.

Each day's files are written first, then that day's rows are deleted and committed. A file that
already exists is never overwritten: the run stops with an error and leaves the rows in place.
"""

from collections import defaultdict
from collections.abc import Callable
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pyarrow as pa
import pyarrow.parquet as pq
from nova_db.models import DataJob, Tick
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from nova_atlas.download import finish_job

IST = ZoneInfo("Asia/Kolkata")
SCHEMA = pa.schema(
    [
        ("exchange", pa.string()),
        ("symbol", pa.string()),
        ("received_at", pa.timestamp("us", tz="UTC")),
        ("exchange_ts", pa.timestamp("us", tz="UTC")),
        ("last_price_paise", pa.int64()),
        ("last_qty", pa.int64()),
        ("volume", pa.int64()),
        ("oi", pa.int64()),
    ]
)
COLUMNS = tuple(SCHEMA.names)


def _start(day: date) -> datetime:
    return datetime.combine(day, time(0), IST)


def tick_path(root: Path, day: date, symbol: str) -> Path:
    return root / f"date={day.isoformat()}" / f"symbol={symbol}" / "ticks.parquet"


def _archive_day(db: Session, root: Path, day: date) -> tuple[list[Path], int]:
    window = (Tick.received_at >= _start(day), Tick.received_at < _start(day + timedelta(days=1)))
    rows = db.execute(select(*(getattr(Tick, c) for c in COLUMNS)).where(*window)).all()
    # Any: one symbol's column values, by column name.
    by_symbol: dict[str, dict[str, list[Any]]] = defaultdict(lambda: {c: [] for c in COLUMNS})
    for row in sorted(rows, key=lambda r: (r.symbol, r.received_at)):
        for column in COLUMNS:
            by_symbol[row.symbol][column].append(getattr(row, column))
    paths = {symbol: tick_path(root, day, symbol) for symbol in by_symbol}
    taken = [str(p) for p in paths.values() if p.exists()]
    if taken:
        raise ValueError(f"Already archived, not overwriting: {', '.join(taken)}")
    for symbol, columns in by_symbol.items():
        path = paths[symbol]
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix(".parquet.partial")
        pq.write_table(pa.table(columns, schema=SCHEMA), partial)
        partial.replace(path)
    db.execute(delete(Tick).where(*window))
    db.commit()
    return sorted(paths.values()), len(rows)


def archive_ticks(
    db: Session, root: Path, before: date, on_day: Callable[[date, int], bool] | None = None
) -> list[Path]:
    """Moves every tick received before `before` (IST) to Parquet; returns the files written.

    `on_day(day, ticks_moved)` runs after each archived day; returning False stops before the next.
    """
    written: list[Path] = []
    cutoff = _start(before)
    while True:
        first = db.scalar(select(func.min(Tick.received_at)).where(Tick.received_at < cutoff))
        if first is None:
            return written
        day = first.astimezone(IST).date()
        paths, moved = _archive_day(db, root, day)
        written += paths
        if on_day is not None and not on_day(day, moved):
            return written


def archive_days(db: Session, before: date) -> list[date]:
    """The IST dates that still have ticks received before `before`."""
    local_day = func.date(func.timezone("Asia/Kolkata", Tick.received_at))
    query = select(local_day).where(Tick.received_at < _start(before)).distinct()
    return sorted(db.scalars(query))


def archive_symbols(db: Session, before: date) -> list[str]:
    query = select(Tick.symbol).where(Tick.received_at < _start(before)).distinct()
    return sorted(db.scalars(query))


def read_ticks(path: Path) -> list[dict[str, Any]]:
    """One archived file as rows (for checks and tests)."""
    rows: list[dict[str, Any]] = pq.read_table(path).to_pylist()
    return rows


def run_archive(db: Session, job_id: str, root: Path) -> None:
    """Runs one claimed `archive` job: every tick before `to` + 1 day, a day at a time (D54).

    Progress moves per day; `rows_written` counts the ticks moved; a cancel stops between days.
    """
    job = db.get(DataJob, job_id)
    if job is None or job.date_to is None:
        raise ValueError(f"Job {job_id} is not a runnable archive")
    before = job.date_to + timedelta(days=1)
    total = max(len(archive_days(db, before)), 1)
    done = 0

    def on_day(_: date, moved: int) -> bool:
        nonlocal done
        done += 1
        db.refresh(job)
        job.rows_written += moved
        job.progress_percent = min(Decimal(done * 100) / Decimal(total), Decimal(100))
        db.commit()
        return job.status != "cancelled"

    try:
        archive_ticks(db, root, before, on_day)
    except (ValueError, OSError) as exc:
        db.rollback()
        finish_job(db, job, str(exc) or type(exc).__name__)
        return
    db.refresh(job)
    if job.status == "cancelled":
        job.finished_at = datetime.now(UTC)
        db.commit()
        return
    finish_job(db, job, None)
