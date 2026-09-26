from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from nova_atlas.broker_client import BrokerData
from nova_atlas.download import Pacer, run_download
from nova_atlas.jobs import queue_download
from nova_atlas.universe import sync_instruments
from nova_db.models import AuditEntry, Candle, DataJob, DataJobStep
from nova_db.queue import claim_next
from nova_testing.parity import Parity
from sqlalchemy import Engine, func, select, update
from sqlalchemy.orm import Session

JOBS = "/api/v1/data-jobs"


def _download(engine: Engine, broker: BrokerData, symbols: list[str], first: date) -> str:
    """A completed 1d download of `symbols` from `first` to 30 Sep 2026."""
    with Session(engine) as db:
        job = queue_download(
            db,
            symbols=symbols,
            timeframe="1d",
            first=first,
            last=date(2026, 9, 30),
            segment="equity_delivery",
        )
        db.commit()
        claim_next(db, DataJob)
        run_download(db, job.id, broker, Pacer(sleep=lambda _: None))
        return job.id


def _candles(engine: Engine, symbol: str) -> int:
    with Session(engine) as db:
        count = db.scalar(select(func.count()).select_from(Candle).where(Candle.symbol == symbol))
        return count or 0


@pytest.fixture
def synced(clean: Engine, broker: BrokerData) -> Engine:
    with Session(clean) as db:
        sync_instruments(db, broker, today=date(2026, 9, 25))
    return clean


def test_delete_keeps_candles_unless_asked(
    synced: Engine, broker: BrokerData, client: TestClient, parity: Parity
) -> None:
    job_id = _download(synced, broker, ["INFY"], date(2026, 9, 1))

    response = client.delete(f"{JOBS}/{job_id}")

    assert response.status_code == 200
    assert response.json() == {"id": job_id, "candlesDeleted": 0}
    parity.assert_valid(response.json(), "DataJobDeleteResult")
    assert _candles(synced, "INFY") == 22
    with Session(synced) as db:
        assert db.get(DataJob, job_id) is None
        assert db.scalars(select(DataJobStep).where(DataJobStep.job_id == job_id)).all() == []
    assert client.get(f"{JOBS}/{job_id}").status_code == 404


def test_delete_with_candles_removes_only_that_jobs_rows(
    synced: Engine, broker: BrokerData, client: TestClient
) -> None:
    job_id = _download(synced, broker, ["INFY", "TCS"], date(2026, 9, 15))
    _download(synced, broker, ["INFY"], date(2026, 8, 1))  # other rows: INFY, August
    with Session(synced) as db:  # a 1m candle in the same days stays: another timeframe
        db.add(
            Candle(
                exchange="NSE",
                symbol="TCS",
                timeframe="1m",
                ts=datetime(2026, 9, 16, 4, 0, tzinfo=UTC),
                open_paise=100,
                high_paise=110,
                low_paise=90,
                close_paise=105,
                volume=1,
            )
        )
        db.commit()
    infy_before = _candles(synced, "INFY")

    response = client.delete(f"{JOBS}/{job_id}", params={"candles": "true"})

    # 15-30 Sep 2026 has 12 weekdays, for each of the two stocks.
    assert response.json() == {"id": job_id, "candlesDeleted": 24}
    assert _candles(synced, "TCS") == 1
    assert _candles(synced, "INFY") == infy_before - 12
    with Session(synced) as db:
        audit = db.scalars(select(AuditEntry).where(AuditEntry.action == "data_job.delete")).one()
    assert audit.summary == "Deleted 1d download of 2 symbol(s) and 24 candles"
    assert audit.target_id == job_id and audit.actor_id == "usr_owner"


@pytest.mark.parametrize("status", ["queued", "running", "paused"])
def test_unfinished_jobs_cannot_be_deleted(
    synced: Engine, broker: BrokerData, client: TestClient, status: str
) -> None:
    job_id = _download(synced, broker, ["INFY"], date(2026, 9, 1))
    with Session(synced) as db:
        db.execute(
            update(DataJob)
            .where(DataJob.id == job_id)
            .values(status=status, started_at=None, finished_at=None, progress_percent=50)
        )
        db.commit()

    response = client.delete(f"{JOBS}/{job_id}")

    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Cancel or finish the job first"


def test_a_draft_can_be_discarded(synced: Engine, client: TestClient) -> None:
    body = {"symbols": ["INFY"], "timeframe": "1d", "from": "2026-09-01", "to": "2026-09-25"}
    job_id = client.post(f"{JOBS}/plan", json=body).json()["id"]

    assert client.delete(f"{JOBS}/{job_id}").status_code == 200
    assert client.get(f"{JOBS}/{job_id}").status_code == 404


def test_candles_only_for_downloads_and_unknown_jobs_404(
    synced: Engine, client: TestClient
) -> None:
    sync = client.post("/api/v1/market-data/instruments/sync").json()
    with Session(synced) as db:
        db.execute(update(DataJob).where(DataJob.id == sync["id"]).values(status="cancelled"))
        db.commit()

    refused = client.delete(f"{JOBS}/{sync['id']}", params={"candles": "true"})

    assert refused.status_code == 400
    assert client.delete(f"{JOBS}/{sync['id']}").status_code == 200
    assert client.delete(f"{JOBS}/job_missing").status_code == 404
