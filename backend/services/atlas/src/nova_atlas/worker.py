"""The data-job worker (D41): one process, polls the queue, runs jobs one at a time."""

import logging
import threading
import time
from collections.abc import Callable
from pathlib import Path

from nova_db.models import DataJob
from nova_db.queue import claim_next, requeue_running
from sqlalchemy.orm import Session, sessionmaker

from nova_atlas.archive import run_archive
from nova_atlas.broker_client import BrokerData
from nova_atlas.download import fail_job, run_download
from nova_atlas.job_control import expire_drafts
from nova_atlas.sync_job import run_instrument_sync

logger = logging.getLogger("nova.atlas.worker")

# Job types this worker runs; `tick_record` jobs belong to the broker's recorder (D54).
WORKER_TYPES = ("historical_download", "archive", "instrument_sync")
OWNED = DataJob.type.in_(WORKER_TYPES)
# How often an idle worker checks whether the daily sync is due (D56).
SCHEDULE_EVERY_SECONDS = 60.0
# Queues timed jobs; True when it queued one.
Schedule = Callable[[Session, BrokerData], bool]


def crash_message(exc: BaseException) -> str:
    """Class + first line only: SQLAlchemy puts the SQL and its parameters on later lines."""
    lines = str(exc).strip().splitlines()
    first = lines[0][:120] if lines else ""
    detail = f": {first}" if first else ""
    return f"Unexpected error ({type(exc).__name__}){detail}. The worker log has details."


def _run(db: Session, job_id: str, broker: BrokerData, archive_dir: Path) -> None:
    job = db.get(DataJob, job_id)
    if job is not None and job.type == "archive":
        run_archive(db, job_id, archive_dir)
    elif job is not None and job.type == "instrument_sync":
        run_instrument_sync(db, job_id, broker)
    else:
        run_download(db, job_id, broker)


def run_worker(
    session_factory: sessionmaker[Session],
    broker: BrokerData,
    stop: threading.Event,
    poll_seconds: float,
    on_idle: Callable[[], None] | None = None,
    archive_dir: Path = Path("archive"),
    schedule: Schedule | None = None,
    clock: Callable[[], float] = time.monotonic,
) -> None:
    """Runs until `stop` is set; `on_idle` runs whenever the queue is empty (tests stop there).

    Once a minute while idle it cancels expired plans (D57) and runs `schedule`, which queues
    timed jobs (the daily sync, D56).
    """
    with session_factory() as db:
        requeued = requeue_running(db, DataJob, OWNED)
    if requeued:
        logger.info("Requeued %s interrupted job(s)", requeued)
    next_schedule_check = clock()
    while not stop.is_set():
        with session_factory() as db:
            job_id = claim_next(db, DataJob, OWNED)
            if job_id is not None:
                logger.info("Running data job %s", job_id)
                try:
                    _run(db, job_id, broker, archive_dir)
                except Exception as exc:
                    # Anything unexpected fails this job only; the worker keeps serving the queue.
                    logger.exception("Data job %s crashed", job_id)
                    db.rollback()
                    fail_job(db, job_id, crash_message(exc))
                continue
            due = clock() >= next_schedule_check
            if due:
                next_schedule_check = clock() + SCHEDULE_EVERY_SECONDS
                try:
                    if expired := expire_drafts(db):
                        logger.info("Cancelled %s expired plan(s)", expired)
                except Exception:
                    logger.exception("Expiring plans failed")
                    db.rollback()
            if due and schedule is not None:
                try:
                    if schedule(db, broker):
                        logger.info("Queued the daily instrument sync")
                        continue
                except Exception:
                    logger.exception("Daily sync check failed")
                    db.rollback()
        if on_idle is not None:
            on_idle()
        stop.wait(poll_seconds)
