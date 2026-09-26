"""`instrument_sync` jobs and the daily schedule (D56), against the fake broker."""

import threading
from datetime import UTC, datetime, timedelta

import pytest
from nova_atlas.broker_client import NOT_LOGGED_IN, BrokerData
from nova_atlas.sync_job import maybe_queue_daily_sync, queue_instrument_sync, run_instrument_sync
from nova_atlas.worker import run_worker
from nova_db.models import AuditEntry, DataJob, UniverseEntry
from nova_testing.broker import FakeBroker
from sqlalchemy import Engine, delete, select, update
from sqlalchemy.orm import Session, sessionmaker

# Monday 28 Sep 2026, in UTC: 03:00 is 08:30 IST, 03:30 is 09:00 IST.
BEFORE = datetime(2026, 9, 28, 3, 0, tzinfo=UTC)
AFTER = datetime(2026, 9, 28, 3, 30, tzinfo=UTC)
SATURDAY = datetime(2026, 9, 26, 5, 0, tzinfo=UTC)


def _queue(engine: Engine) -> str:
    with Session(engine) as db:
        job = queue_instrument_sync(db)
        db.commit()
        return job.id


def _job(engine: Engine, job_id: str) -> DataJob:
    with Session(engine) as db:
        job = db.get(DataJob, job_id)
        assert job is not None
        return job


def test_the_worker_runs_a_sync_to_completion(
    factory: sessionmaker[Session], clean: Engine, broker: BrokerData
) -> None:
    job_id = _queue(clean)
    stop = threading.Event()

    run_worker(factory, broker, stop, poll_seconds=0, on_idle=stop.set)

    job = _job(clean, job_id)
    assert job.status == "completed" and job.progress_percent == 100 and job.rows_written == 3
    assert job.summary is not None and job.summary.startswith("3 stocks synced")


def test_the_second_sync_marks_new_listings(clean: Engine, broker: BrokerData) -> None:
    first = _queue(clean)
    with Session(clean) as db:
        run_instrument_sync(db, first, broker)
        db.execute(delete(UniverseEntry).where(UniverseEntry.symbol == "TCS"))
        db.commit()
    second = _queue(clean)
    with Session(clean) as db:
        run_instrument_sync(db, second, broker)
        tcs = db.get(UniverseEntry, ("NSE", "TCS"))

    assert tcs is not None and tcs.new_listing
    assert "new listing(s): TCS" in (_job(clean, second).summary or "")


def test_kite_not_logged_in_fails_with_a_clear_reason(
    clean: Engine, broker: BrokerData, fake_broker: FakeBroker
) -> None:
    job_id = _queue(clean)
    fake_broker.error = "Log in to Kite in Relay first: no account has a live session"
    with Session(clean) as db:
        run_instrument_sync(db, job_id, broker)

    job = _job(clean, job_id)
    assert job.status == "failed" and job.error == NOT_LOGGED_IN


def test_a_cancelled_sync_stops(clean: Engine, broker: BrokerData) -> None:
    job_id = _queue(clean)
    with Session(clean) as db:
        db.execute(update(DataJob).values(status="cancelled"))
        db.commit()
        run_instrument_sync(db, job_id, broker)

    job = _job(clean, job_id)
    assert job.status == "cancelled" and job.finished_at is not None


@pytest.mark.parametrize(
    ("now", "logged_in", "queued"),
    [(AFTER, True, True), (BEFORE, True, False), (SATURDAY, True, False), (AFTER, False, False)],
    ids=["weekday-after-0845", "before-0845", "saturday", "logged-out"],
)
def test_the_daily_sync_is_queued_once_kite_is_logged_in(
    clean: Engine,
    broker: BrokerData,
    fake_broker: FakeBroker,
    now: datetime,
    logged_in: bool,
    queued: bool,
) -> None:
    fake_broker.logged_in = logged_in
    with Session(clean) as db:
        assert maybe_queue_daily_sync(db, broker, now) is queued
        jobs = list(db.scalars(select(DataJob)))

    assert len(jobs) == (1 if queued else 0)


def test_the_daily_sync_is_not_queued_twice(clean: Engine, broker: BrokerData) -> None:
    with Session(clean) as db:
        assert maybe_queue_daily_sync(db, broker, AFTER)
        db.execute(update(DataJob).values(created_at=AFTER))
        db.commit()
        assert not maybe_queue_daily_sync(db, broker, AFTER + timedelta(hours=2))
        [entry] = db.scalars(select(AuditEntry))

    assert entry.actor_name == "System" and entry.summary == "Queued the daily sync with Kite"


def test_a_failed_daily_sync_is_retried_after_30_minutes(clean: Engine, broker: BrokerData) -> None:
    with Session(clean) as db:
        maybe_queue_daily_sync(db, broker, AFTER)
        db.execute(
            update(DataJob).values(
                status="failed", error="x", created_at=AFTER, started_at=AFTER, finished_at=AFTER
            )
        )
        db.commit()
        assert not maybe_queue_daily_sync(db, broker, AFTER + timedelta(minutes=10))
        assert maybe_queue_daily_sync(db, broker, AFTER + timedelta(minutes=31))
