"""The data-job worker (D41): one process, polls the queue, runs jobs one at a time."""

import logging
import threading
from collections.abc import Callable

from nova_db.models import DataJob
from nova_db.queue import claim_next, requeue_running
from sqlalchemy.orm import Session, sessionmaker

from nova_atlas.broker_client import BrokerData
from nova_atlas.download import fail_job, run_download

logger = logging.getLogger("nova.atlas.worker")


def run_worker(
    session_factory: sessionmaker[Session],
    broker: BrokerData,
    stop: threading.Event,
    poll_seconds: float,
    on_idle: Callable[[], None] | None = None,
) -> None:
    """Runs until `stop` is set; `on_idle` runs whenever the queue is empty (tests stop there)."""
    with session_factory() as db:
        requeued = requeue_running(db, DataJob)
    if requeued:
        logger.info("Requeued %s interrupted job(s)", requeued)
    while not stop.is_set():
        with session_factory() as db:
            job_id = claim_next(db, DataJob)
            if job_id is not None:
                logger.info("Running data job %s", job_id)
                try:
                    run_download(db, job_id, broker)
                except Exception:
                    # Anything unexpected fails this job only; the worker keeps serving the queue.
                    logger.exception("Data job %s crashed", job_id)
                    db.rollback()
                    fail_job(db, job_id, "Unexpected error; see the worker log")
                continue
        if on_idle is not None:
            on_idle()
        stop.wait(poll_seconds)
