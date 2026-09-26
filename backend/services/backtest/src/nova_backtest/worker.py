"""The backtest worker (D41, D44): one process, claims queued runs, runs them one at a time."""

import logging
import threading
from collections.abc import Callable
from datetime import UTC, datetime

from nova_db.models import BacktestRun
from nova_db.queue import claim_next, fail_running
from sqlalchemy.orm import Session, sessionmaker

from nova_backtest.engine import BacktestEngine, EngineError
from nova_backtest.progress import Progress, ProgressSink

logger = logging.getLogger("nova.backtest.worker")
ERROR_LENGTH = 300
# D59: a crash (often out of memory) would repeat if the run were requeued, so it fails instead.
STOPPED_MESSAGE = (
    "The backtest worker stopped during this run (often: not enough memory). Run it again; "
    "if it stops again, pick fewer stocks or a shorter period."
)


def fail_run(db: Session, run_id: str, message: str) -> None:
    run = db.get(BacktestRun, run_id)
    if run is not None:
        run.status = "failed"
        run.error = message[:ERROR_LENGTH]
        run.finished_at = datetime.now(UTC)
        db.commit()


def run_one(db: Session, run_id: str, engine: BacktestEngine, progress: ProgressSink) -> None:
    """Runs one claimed run; any failure ends as a `failed` run, never a crashed worker."""
    try:
        engine.run(db, run_id, progress)
    except EngineError as exc:
        db.rollback()
        fail_run(db, run_id, str(exc))
    except Exception:
        logger.exception("Backtest %s crashed", run_id)
        db.rollback()
        fail_run(db, run_id, "Unexpected error; see the worker log")


def run_worker(
    session_factory: sessionmaker[Session],
    engine: BacktestEngine,
    stop: threading.Event,
    poll_seconds: float,
    on_idle: Callable[[], None] | None = None,
) -> None:
    """Runs until `stop` is set; `on_idle` runs whenever the queue is empty (tests stop there)."""
    with session_factory() as db:
        failed = fail_running(db, BacktestRun, STOPPED_MESSAGE)
    if failed:
        logger.info("Failed %s run(s) interrupted by a worker stop", failed)
    while not stop.is_set():
        with session_factory() as db:
            run_id = claim_next(db, BacktestRun)
            if run_id is not None:
                logger.info("Running backtest %s", run_id)
                run_one(db, run_id, engine, Progress(session_factory, run_id))
                continue
        if on_idle is not None:
            on_idle()
        stop.wait(poll_seconds)
