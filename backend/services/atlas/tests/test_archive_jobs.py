"""Tick archive as a data job (D54): `POST /data-jobs/archive` and the worker."""

import threading
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import nova_atlas.archive as archive
import pytest
from fastapi.testclient import TestClient
from nova_atlas.archive import tick_path
from nova_atlas.broker_client import BrokerData
from nova_atlas.jobs import queue_archive
from nova_atlas.worker import run_worker
from nova_db.models import AuditEntry, DataJob, Tick
from nova_testing.parity import Parity
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session, sessionmaker

ARCHIVE = "/api/v1/data-jobs/archive"
DAY1 = datetime(2026, 9, 21, 4, 0, tzinfo=UTC)  # 09:30 IST


def seed(engine: Engine) -> None:
    """Ticks on 21, 22 and 23 Sep (IST)."""
    with Session(engine) as db:
        for day, symbol in [(0, "INFY"), (0, "TCS"), (1, "INFY"), (2, "INFY")]:
            at = DAY1 + timedelta(days=day)
            db.add(
                Tick(
                    exchange="NSE",
                    symbol=symbol,
                    received_at=at,
                    exchange_ts=at,
                    last_price_paise=100,
                    last_qty=1,
                    volume=10,
                )
            )
        db.commit()


def ticks_left(engine: Engine) -> int:
    with Session(engine) as db:
        return db.scalar(select(func.count()).select_from(Tick)) or 0


def test_queue_describes_what_it_will_move(
    client: TestClient, clean: Engine, parity: Parity
) -> None:
    seed(clean)

    response = client.post(ARCHIVE, json={"before": "2026-09-23"})

    assert response.status_code == 201
    job = response.json()
    parity.assert_valid(job, "DataJob")
    assert job["type"] == "archive" and job["status"] == "queued"
    assert job["symbols"] == ["INFY", "TCS"] and job["timeframe"] is None
    assert (job["from"], job["to"]) == ("2026-09-21", "2026-09-22")
    with Session(clean) as db:
        entry = db.scalars(select(AuditEntry)).one()
    assert entry.summary == "Queued archive of ticks before 2026-09-23"


@pytest.mark.parametrize(
    ("before", "message"),
    [("2026-09-21", "No ticks before 2026-09-21"), ("2999-01-01", "today or earlier")],
)
def test_queue_refuses_nothing_to_do_and_future_dates(
    client: TestClient, clean: Engine, before: str, message: str
) -> None:
    seed(clean)

    response = client.post(ARCHIVE, json={"before": before})

    assert response.status_code == 400
    assert message in response.json()["error"]["message"]


def _run(factory: sessionmaker[Session], broker: BrokerData, root: Path) -> None:
    stop = threading.Event()
    run_worker(factory, broker, stop, poll_seconds=0, on_idle=stop.set, archive_dir=root)


def test_worker_moves_the_ticks_and_counts_them(
    client: TestClient,
    clean: Engine,
    factory: sessionmaker[Session],
    broker: BrokerData,
    tmp_path: Path,
) -> None:
    seed(clean)
    job_id = client.post(ARCHIVE, json={"before": "2026-09-23"}).json()["id"]

    _run(factory, broker, tmp_path)

    job = client.get(f"/api/v1/data-jobs/{job_id}").json()
    assert job["status"] == "completed" and job["rowsWritten"] == 3
    assert job["progressPercent"] == 100
    assert tick_path(tmp_path, date(2026, 9, 21), "TCS").exists()
    assert tick_path(tmp_path, date(2026, 9, 22), "INFY").exists()
    assert ticks_left(clean) == 1  # 23 Sep stays


def test_worker_stops_between_days_when_cancelled(
    clean: Engine,
    factory: sessionmaker[Session],
    broker: BrokerData,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed(clean)
    with Session(clean) as db:
        job_id = queue_archive(db, before=date(2026, 9, 24)).id
        db.commit()

    real = archive._archive_day

    def archive_then_cancel(db: Session, root: Path, day: date) -> tuple[list[Path], int]:
        result = real(db, root, day)
        with Session(clean) as other:
            job = other.get(DataJob, job_id)
            assert job is not None
            job.status = "cancelled"
            other.commit()
        return result

    monkeypatch.setattr(archive, "_archive_day", archive_then_cancel)

    _run(factory, broker, tmp_path)

    with Session(clean) as db:
        job = db.get(DataJob, job_id)
    assert job is not None and job.status == "cancelled" and job.finished_at is not None
    assert job.rows_written == 2 and ticks_left(clean) == 2


def test_worker_fails_the_job_rather_than_overwrite(
    client: TestClient,
    clean: Engine,
    factory: sessionmaker[Session],
    broker: BrokerData,
    tmp_path: Path,
) -> None:
    seed(clean)
    existing = tick_path(tmp_path, date(2026, 9, 21), "TCS")
    existing.parent.mkdir(parents=True)
    existing.write_bytes(b"keep")
    job_id = client.post(ARCHIVE, json={"before": "2026-09-22"}).json()["id"]

    _run(factory, broker, tmp_path)

    job = client.get(f"/api/v1/data-jobs/{job_id}").json()
    assert job["status"] == "failed" and "not overwriting" in job["error"]
    assert ticks_left(clean) == 4
