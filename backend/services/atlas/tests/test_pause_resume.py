from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

import pytest
from nova_atlas.broker_client import BrokerData
from nova_atlas.download import Pacer, run_download
from nova_atlas.jobs import queue_download
from nova_atlas.universe import sync_instruments
from nova_db.models import DataJob, DataJobStep
from nova_db.queue import claim_next, requeue_running
from nova_testing.broker import FakeBroker
from sqlalchemy import Engine, func, select, update
from sqlalchemy.orm import Session

THURSDAY_10AM_IST = datetime(2026, 9, 24, 4, 30, tzinfo=UTC)
SATURDAY = datetime(2026, 9, 26, 6, 0, tzinfo=UTC)


class Interrupted(BaseException):
    """Stands in for the worker being killed: not caught by `run_download`."""


class HookedBroker(BrokerData):
    """Runs `hook(call_number)` before each historical request."""

    def __init__(self, inner: BrokerData, hook: Callable[[int], None]) -> None:
        self._inner, self._hook, self.calls = inner, hook, 0

    def historical(
        self, instrument_token: int, interval: str, start: datetime, end: datetime
    ) -> list[list[Any]]:
        self.calls += 1
        self._hook(self.calls)
        return self._inner.historical(instrument_token, interval, start, end)


@pytest.fixture
def job_id(clean: Engine, broker: BrokerData) -> str:
    """A 1m download of INFY and TCS over 4 chunks each: 8 steps."""
    with Session(clean) as db:
        sync_instruments(db, broker, today=date(2026, 9, 25))
        job = queue_download(
            db,
            symbols=["INFY", "TCS"],
            timeframe="1m",
            first=date(2026, 3, 1),
            last=date(2026, 9, 25),
            segment="equity_delivery",
        )
        db.commit()
        claim_next(db, DataJob)
        return job.id


def _set_status(engine: Engine, job_id: str, status: str) -> None:
    with Session(engine) as db:
        db.execute(update(DataJob).where(DataJob.id == job_id).values(status=status))
        db.commit()


def _state(engine: Engine, job_id: str) -> tuple[str, int, int]:
    with Session(engine) as db:
        job = db.get(DataJob, job_id)
        assert job is not None
        done = db.scalar(
            select(func.count())
            .select_from(DataJobStep)
            .where(DataJobStep.job_id == job_id, DataJobStep.status == "done")
        )
        return job.status, job.steps_done, done or 0


def _no_wait() -> Pacer:
    return Pacer(sleep=lambda _: None)


def test_pause_after_two_steps_then_resume_runs_each_step_once(
    clean: Engine, broker: BrokerData, fake_broker: FakeBroker, job_id: str
) -> None:
    def pause_on_second(call: int) -> None:
        if call == 2:
            _set_status(clean, job_id, "paused")  # the Owner presses Pause during step 2

    with Session(clean) as db:
        run_download(db, job_id, HookedBroker(broker, pause_on_second), _no_wait())
    assert _state(clean, job_id) == ("paused", 2, 2)

    with Session(clean) as db:  # Resume
        db.execute(
            update(DataJob).where(DataJob.id == job_id).values(status="queued", started_at=None)
        )
        db.commit()
    with Session(clean) as db:
        assert claim_next(db, DataJob) == job_id
        run_download(db, job_id, broker, _no_wait())

    with Session(clean) as db:
        job = db.get(DataJob, job_id)
    assert job is not None and job.status == "completed" and job.progress_percent == 100
    assert _state(clean, job_id) == ("completed", 8, 8)
    assert len(fake_broker.history_calls) == 8


def test_a_killed_worker_continues_from_the_next_unfinished_step(
    clean: Engine, broker: BrokerData, fake_broker: FakeBroker, job_id: str
) -> None:
    def die_on_fourth(call: int) -> None:
        if call == 4:
            raise Interrupted

    with Session(clean) as db, pytest.raises(Interrupted):
        run_download(db, job_id, HookedBroker(broker, die_on_fourth), _no_wait())
    assert _state(clean, job_id) == ("running", 3, 3)

    with Session(clean) as db:  # the worker restarts
        assert requeue_running(db, DataJob) == 1
        assert claim_next(db, DataJob) == job_id
        run_download(db, job_id, broker, _no_wait())

    assert _state(clean, job_id) == ("completed", 8, 8)
    assert len(fake_broker.history_calls) == 8  # the 4th request never reached the broker before


def test_cancel_between_steps_stops_the_job(clean: Engine, broker: BrokerData, job_id: str) -> None:
    def cancel_on_third(call: int) -> None:
        if call == 3:
            _set_status(clean, job_id, "cancelled")

    with Session(clean) as db:
        run_download(db, job_id, HookedBroker(broker, cancel_on_third), _no_wait())

    status, steps_done, _ = _state(clean, job_id)
    assert (status, steps_done) == ("cancelled", 3)


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.slept: list[float] = []

    def sleep(self, seconds: float) -> None:
        self.slept.append(round(seconds, 3))
        self.now += seconds


@pytest.mark.parametrize(
    ("at", "mode", "expected"),
    [
        (THURSDAY_10AM_IST, "slow", [0.9, 0.9]),
        (THURSDAY_10AM_IST, "full", []),
        (SATURDAY, "slow", []),
    ],
)
def test_slow_mode_paces_market_hours_to_one_request_a_second(
    at: datetime, mode: str, expected: list[float]
) -> None:
    clock = FakeClock()
    pacer = Pacer(clock=lambda: clock.now, sleep=clock.sleep, now=lambda: at)

    for _ in range(3):
        pacer.wait(mode)
        clock.now += 0.1  # the request itself

    assert clock.slept == expected
