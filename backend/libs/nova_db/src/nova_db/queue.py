"""PostgreSQL is the job queue (D41): claims use `FOR UPDATE SKIP LOCKED`.

Works for any table with `id`, `status` (`queued` / `running` / …), `created_at` and `started_at`:
data jobs (Atlas) and backtest runs (backtest service).
"""

from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from nova_db.models import BacktestRun, DataJob

QueueTable = type[DataJob] | type[BacktestRun]


def lock_next(db: Session, table: QueueTable) -> DataJob | BacktestRun | None:
    """Locks the oldest queued row in the current transaction; other workers skip it."""
    query = (
        select(table)
        .where(table.status == "queued")
        .order_by(table.created_at, table.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    row = db.scalars(query).first()
    if row is not None and not isinstance(row, DataJob | BacktestRun):
        raise TypeError(f"{table.__name__} is not a queue table")
    return row


def claim_next(db: Session, table: QueueTable) -> str | None:
    """Marks the oldest queued row `running` and returns its id, or None when the queue is empty."""
    row = lock_next(db, table)
    if row is None:
        db.rollback()
        return None
    row.status = "running"
    row.started_at = datetime.now(UTC)
    db.commit()
    return row.id


def requeue_running(db: Session, table: QueueTable) -> int:
    """Puts back rows a stopped worker left `running` (one worker per table in Phase 1)."""
    requeued = db.scalars(
        update(table)
        .where(table.status == "running")
        .values(status="queued", started_at=None)
        .returning(table.id)
    ).all()
    db.commit()
    return len(requeued)
