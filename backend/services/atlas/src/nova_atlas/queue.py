"""PostgreSQL is the job queue (D41): claims use `FOR UPDATE SKIP LOCKED`."""

from datetime import UTC, datetime

from nova_db.models import DataJob
from sqlalchemy import select, update
from sqlalchemy.orm import Session


def lock_next(db: Session) -> DataJob | None:
    """Locks the oldest queued job in the current transaction; other workers skip it."""
    query = (
        select(DataJob)
        .where(DataJob.status == "queued")
        .order_by(DataJob.created_at, DataJob.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    return db.scalars(query).first()


def claim_next(db: Session) -> str | None:
    """Marks the oldest queued job `running` and returns its id, or None when the queue is empty."""
    job = lock_next(db)
    if job is None:
        db.rollback()
        return None
    job.status = "running"
    job.started_at = datetime.now(UTC)
    db.commit()
    return job.id


def requeue_running(db: Session) -> int:
    """Puts back jobs a stopped worker left `running` (one worker in Phase 1; reruns are safe)."""
    requeued = db.scalars(
        update(DataJob)
        .where(DataJob.status == "running")
        .values(status="queued", started_at=None)
        .returning(DataJob.id)
    ).all()
    db.commit()
    return len(requeued)
