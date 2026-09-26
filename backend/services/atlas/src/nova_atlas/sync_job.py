"""`instrument_sync` data jobs (D56): queued from Relay or each weekday morning."""

from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from nova_db import new_id
from nova_db.audit import record_audit
from nova_db.models import DataJob
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nova_atlas.broker_client import BrokerData, BrokerDataError
from nova_atlas.download import finish_job
from nova_atlas.universe import sync_instruments

IST = ZoneInfo("Asia/Kolkata")
DAILY_AT = time(8, 45)
# After a failed daily sync, wait this long before queueing the next try.
RETRY_AFTER = timedelta(minutes=30)
SYSTEM = "System"


class Cancelled(Exception):
    """The Owner cancelled the running sync."""


def queue_instrument_sync(
    db: Session,
    *,
    actor_id: str | None = None,
    actor_name: str = SYSTEM,
    ip: str | None = None,
    reason: str = "Queued sync with Kite",
) -> DataJob:
    """Adds a `queued` sync; refuses a second one while one is waiting or running."""
    busy = db.scalar(
        select(DataJob.id).where(
            DataJob.type == "instrument_sync", DataJob.status.in_(("queued", "running"))
        )
    )
    if busy is not None:
        raise ValueError(f"A sync is already waiting or running ({busy})")
    job = DataJob(
        id=new_id("job"),
        type="instrument_sync",
        status="queued",
        exchange="NSE",
        segment="equity_delivery",
        symbols=[],
    )
    db.add(job)
    record_audit(
        db,
        action="instrument.sync",
        actor_id=actor_id,
        actor_name=actor_name,
        summary=reason,
        target_type="data_job",
        target_id=job.id,
        ip=ip,
    )
    return job


def run_instrument_sync(db: Session, job_id: str, broker: BrokerData) -> None:
    """Runs one claimed sync to `completed` (with a summary), `failed` or `cancelled`."""
    job = db.get(DataJob, job_id)
    if job is None or job.type != "instrument_sync":
        raise ValueError(f"Job {job_id} is not an instrument sync")
    earlier = db.scalar(
        select(func.count()).where(
            DataJob.type == "instrument_sync",
            DataJob.status == "completed",
            DataJob.id != job_id,
        )
    )

    def progress(share: float, _step: str) -> None:
        db.refresh(job, ["status"])
        if job.status == "cancelled":
            raise Cancelled
        job.progress_percent = Decimal(round(share * 100, 2))
        db.commit()

    try:
        result = sync_instruments(db, broker, mark_new=bool(earlier), progress=progress)
    except Cancelled:
        db.rollback()
        job.finished_at = datetime.now(UTC)
        db.commit()
        return
    except BrokerDataError as exc:
        db.rollback()
        finish_job(db, job, str(exc))
        return
    job.rows_written = len(result.synced)
    job.summary = result.summary()
    finish_job(db, job, None)


def maybe_queue_daily_sync(db: Session, broker: BrokerData, now: datetime | None = None) -> bool:
    """Queues the weekday-morning sync once Kite is logged in (D56). True when it queued one."""
    now = now or datetime.now(UTC)
    local = now.astimezone(IST)
    if local.weekday() >= 5 or local.time() < DAILY_AT:
        return False
    start_of_day = datetime.combine(local.date(), time(0, 0), IST)
    today = select(DataJob.status, DataJob.created_at).where(
        DataJob.type == "instrument_sync", DataJob.created_at >= start_of_day
    )
    for status, created_at in db.execute(today):
        if status in ("queued", "running", "completed") or now - created_at < RETRY_AFTER:
            return False
    try:
        if not broker.logged_in():
            return False
    except BrokerDataError:
        return False
    queue_instrument_sync(db, reason="Queued the daily sync with Kite")
    db.commit()
    return True
