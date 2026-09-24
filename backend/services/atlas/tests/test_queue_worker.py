import threading
from datetime import date

from nova_atlas.broker_client import BrokerData
from nova_atlas.cli import queue_download
from nova_atlas.queue import claim_next, lock_next, requeue_running
from nova_atlas.universe import sync_instruments
from nova_atlas.worker import run_worker
from nova_db.models import DataJob
from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session, sessionmaker


def _queue(engine: Engine, count: int) -> list[str]:
    ids = []
    with Session(engine) as db:
        for day in range(1, count + 1):
            job = queue_download(
                db,
                symbols=["INFY"],
                timeframe="1d",
                first=date(2026, 9, day),
                last=date(2026, 9, day),
                segment="equity_delivery",
            )
            db.commit()
            ids.append(job.id)
    return ids


def test_claims_the_oldest_job_first(clean: Engine) -> None:
    first, second = _queue(clean, 2)

    with Session(clean) as db:
        assert claim_next(db) == first
        assert claim_next(db) == second
        assert claim_next(db) is None
        job = db.get(DataJob, first)
        assert job is not None and job.status == "running" and job.started_at is not None


def test_two_workers_never_claim_the_same_job(clean: Engine) -> None:
    first, second = _queue(clean, 2)

    with Session(clean) as holder, Session(clean) as other:
        locked = lock_next(holder)  # a worker is claiming `first` and has not committed yet
        assert locked is not None and locked.id == first
        assert claim_next(other) == second


def test_interrupted_jobs_are_requeued(clean: Engine) -> None:
    (job_id,) = _queue(clean, 1)
    with Session(clean) as db:
        claim_next(db)
        assert requeue_running(db) == 1
        job = db.get(DataJob, job_id)
        assert job is not None and job.status == "queued" and job.started_at is None


def test_worker_runs_queued_jobs_until_stopped(
    factory: sessionmaker[Session], clean: Engine, broker: BrokerData
) -> None:
    with Session(clean) as db:
        sync_instruments(db, broker, today=date(2026, 9, 25))
    ids = _queue(clean, 2)
    with Session(clean) as db:  # one job was left running by a worker that stopped
        db.execute(update(DataJob).where(DataJob.id == ids[0]).values(status="running"))
        db.commit()
    stop = threading.Event()

    run_worker(factory, broker, stop, poll_seconds=0, on_idle=stop.set)

    with Session(clean) as db:
        jobs = db.scalars(select(DataJob).order_by(DataJob.created_at)).all()
    assert [job.status for job in jobs] == ["completed", "completed"]


def test_worker_survives_a_broken_job(
    factory: sessionmaker[Session], clean: Engine, broker: BrokerData
) -> None:
    (job_id,) = _queue(clean, 1)
    with Session(clean) as db:  # not runnable: a download without a timeframe
        db.execute(update(DataJob).values(type="archive", timeframe=None))
        db.commit()
    stop = threading.Event()

    run_worker(factory, broker, stop, poll_seconds=0, on_idle=stop.set)

    with Session(clean) as db:
        job = db.get(DataJob, job_id)
    assert job is not None and job.status == "failed"
    assert job.error == "Unexpected error; see the worker log"
