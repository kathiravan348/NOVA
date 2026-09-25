"""Old ticks → Parquet (D49): `archive/date=YYYY-MM-DD/symbol=SYM/ticks.parquet`, a day at a time.

Each day's files are written first, then that day's rows are deleted and committed. A file that
already exists is never overwritten: the run stops with an error and leaves the rows in place.
"""

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pyarrow as pa
import pyarrow.parquet as pq
from nova_db.models import Tick
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

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


def _archive_day(db: Session, root: Path, day: date) -> list[Path]:
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
    return sorted(paths.values())


def archive_ticks(db: Session, root: Path, before: date) -> list[Path]:
    """Moves every tick received before `before` (IST) to Parquet; returns the files written."""
    written: list[Path] = []
    cutoff = _start(before)
    while True:
        first = db.scalar(select(func.min(Tick.received_at)).where(Tick.received_at < cutoff))
        if first is None:
            return written
        written += _archive_day(db, root, first.astimezone(IST).date())


def read_ticks(path: Path) -> list[dict[str, Any]]:
    """One archived file as rows (for checks and tests)."""
    rows: list[dict[str, Any]] = pq.read_table(path).to_pylist()
    return rows
