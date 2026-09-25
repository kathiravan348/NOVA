"""The always-on recorder loop (D54) with a fake clock and a fake Kite socket."""

import threading
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from nova_broker.crypto import TokenCipher
from nova_broker.recorder import Sink
from nova_broker.recorder_loop import RecorderLoop, in_market_hours, session_progress
from nova_broker.settings import BrokerSettings
from nova_db.models import DataJob, RecorderSetting, Tick
from sqlalchemy import Engine, func, select, update
from sqlalchemy.orm import Session, sessionmaker

FRIDAY_10_IST = datetime(2026, 9, 25, 4, 30, tzinfo=UTC)
SATURDAY_10_IST = FRIDAY_10_IST + timedelta(days=1)


class Clock:
    def __init__(self, at: datetime) -> None:
        self.at = at

    def __call__(self) -> datetime:
        return self.at


def rows(count: int, at: datetime) -> list[dict[str, Any]]:
    """Any: `ticks` column values."""
    return [
        {
            "exchange": "NSE",
            "symbol": "INFY",
            "received_at": at + timedelta(microseconds=i),
            "exchange_ts": None,
            "last_price_paise": 150000,
            "last_qty": 1,
            "volume": 10,
            "oi": None,
        }
        for i in range(count)
    ]


Script = Callable[[Sink, Callable[[], bool], Clock], None]


def make_loop(
    engine: Engine, settings: BrokerSettings, clock: Clock, script: Script
) -> RecorderLoop:
    assert settings.broker_token_key is not None

    def record(
        url: str, tokens: dict[int, str], sink: Sink, should_stop: Callable[[], bool]
    ) -> None:
        assert "access_token=" in url and sorted(tokens.values()) == ["INFY", "TCS"]
        script(sink, should_stop, clock)

    return RecorderLoop(
        factory=sessionmaker(bind=engine, expire_on_commit=False),
        api_key="kite-key",
        cipher=TokenCipher(settings.broker_token_key.get_secret_value()),
        stop=threading.Event(),
        record=record,
        now=clock,
    )


def switch(engine: Engine, on: bool) -> None:
    with Session(engine) as db:
        db.execute(update(RecorderSetting).values(enabled=on))
        db.commit()


def job(engine: Engine, job_id: str) -> DataJob:
    with Session(engine) as db:
        found = db.get(DataJob, job_id)
        assert found is not None
        return found


def until_close(sink: Sink, should_stop: Callable[[], bool], clock: Clock) -> None:
    sink(rows(3, clock.at))
    clock.at = FRIDAY_10_IST.replace(hour=10, minute=0)  # 15:30 IST
    assert should_stop()


def test_market_hours_are_weekdays_0915_to_1530_ist() -> None:
    assert in_market_hours(FRIDAY_10_IST)
    assert not in_market_hours(SATURDAY_10_IST)
    assert not in_market_hours(FRIDAY_10_IST.replace(hour=3, minute=44))  # 09:14 IST
    assert not in_market_hours(FRIDAY_10_IST.replace(hour=10, minute=0))  # 15:30 IST
    assert session_progress(FRIDAY_10_IST.replace(hour=3, minute=45)) == 0


def test_switched_off_does_nothing(
    synced: Engine, kite_session: str, settings: BrokerSettings
) -> None:
    loop = make_loop(synced, settings, Clock(FRIDAY_10_IST), until_close)

    assert loop.step() is None


@pytest.mark.parametrize("at", [SATURDAY_10_IST, FRIDAY_10_IST.replace(hour=2)])
def test_outside_market_hours_does_nothing(
    synced: Engine, kite_session: str, settings: BrokerSettings, at: datetime
) -> None:
    switch(synced, True)

    assert make_loop(synced, settings, Clock(at), until_close).step() is None


def test_without_a_kite_login_does_nothing(synced: Engine, settings: BrokerSettings) -> None:
    switch(synced, True)

    assert make_loop(synced, settings, Clock(FRIDAY_10_IST), until_close).step() is None
    with Session(synced) as db:
        assert db.scalar(select(func.count()).select_from(DataJob)) == 0


def test_records_a_session_as_a_completed_job(
    synced: Engine, kite_session: str, settings: BrokerSettings
) -> None:
    switch(synced, True)

    job_id = make_loop(synced, settings, Clock(FRIDAY_10_IST), until_close).step()

    assert job_id is not None
    done = job(synced, job_id)
    assert done.type == "tick_record" and done.status == "completed"
    assert done.rows_written == 3 and done.progress_percent == 100
    assert done.symbols == ["INFY", "TCS"] and done.finished_at is not None
    with Session(synced) as db:
        assert db.scalar(select(func.count()).select_from(Tick)) == 3


def test_switching_off_ends_the_session(
    synced: Engine, kite_session: str, settings: BrokerSettings
) -> None:
    switch(synced, True)

    def script(sink: Sink, should_stop: Callable[[], bool], clock: Clock) -> None:
        sink(rows(2, clock.at))
        clock.at += timedelta(seconds=6)
        assert not should_stop()
        switch(synced, False)
        clock.at += timedelta(seconds=6)
        assert should_stop()

    job_id = make_loop(synced, settings, Clock(FRIDAY_10_IST), script).step()

    assert job_id is not None
    ended = job(synced, job_id)
    assert ended.status == "completed" and ended.rows_written == 2


def test_cancelling_the_job_ends_it_and_switches_off(
    synced: Engine, kite_session: str, settings: BrokerSettings
) -> None:
    switch(synced, True)

    def script(sink: Sink, should_stop: Callable[[], bool], clock: Clock) -> None:
        with Session(synced) as db:
            db.execute(update(DataJob).values(status="cancelled"))
            db.commit()
        clock.at += timedelta(seconds=6)
        assert should_stop()

    job_id = make_loop(synced, settings, Clock(FRIDAY_10_IST), script).step()

    assert job_id is not None
    ended = job(synced, job_id)
    assert ended.status == "cancelled" and ended.finished_at is not None
    with Session(synced) as db:
        setting = db.get(RecorderSetting, 1)
    assert setting is not None and setting.enabled is False


def test_a_failure_fails_the_job_and_waits_before_retrying(
    synced: Engine, kite_session: str, settings: BrokerSettings
) -> None:
    switch(synced, True)

    def script(sink: Sink, should_stop: Callable[[], bool], clock: Clock) -> None:
        raise RuntimeError("socket refused")

    clock = Clock(FRIDAY_10_IST)
    loop = make_loop(synced, settings, clock, script)
    job_id = loop.step()

    assert job_id is not None
    failed = job(synced, job_id)
    assert failed.status == "failed" and failed.error == "socket refused"
    clock.at += timedelta(minutes=1)
    assert loop.step() is None
    clock.at += timedelta(minutes=5)
    assert loop.step() is not None


def test_a_restart_fails_the_recording_it_left_running(
    synced: Engine, settings: BrokerSettings
) -> None:
    with Session(synced) as db:
        db.add(
            DataJob(
                id="job_left",
                type="tick_record",
                status="running",
                exchange="NSE",
                segment="equity_delivery",
                symbols=["INFY"],
                started_at=FRIDAY_10_IST,
            )
        )
        db.commit()

    make_loop(synced, settings, Clock(FRIDAY_10_IST), until_close).recover()

    left = job(synced, "job_left")
    assert left.status == "failed" and left.error is not None
