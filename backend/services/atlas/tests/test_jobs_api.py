from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from nova_atlas.sync_job import queue_instrument_sync
from nova_db.models import AuditEntry, DataJob
from nova_testing.parity import Parity
from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session

JOBS = "/api/v1/data-jobs"


def _seed(engine: Engine, count: int) -> list[str]:
    """`count` queued jobs, one minute apart; returns ids newest first."""
    base = datetime(2026, 9, 1, tzinfo=UTC)
    with Session(engine) as db:
        for i in range(count):
            db.add(
                DataJob(
                    id=f"job_{i:02d}",
                    type="historical_download",
                    status="queued",
                    exchange="NSE",
                    segment="equity_delivery",
                    symbols=["INFY"],
                    timeframe="1d",
                    date_from=date(2026, 1, 1),
                    date_to=date(2026, 6, 30),
                    created_at=base + timedelta(minutes=i),
                )
            )
        db.commit()
    return [f"job_{i:02d}" for i in reversed(range(count))]


def test_needs_the_internal_token(client: TestClient) -> None:
    assert client.get(JOBS, headers={"x-nova-internal-token": "nope"}).status_code == 401


def test_pages_walk_every_job_newest_first(
    client: TestClient, clean: Engine, parity: Parity
) -> None:
    expected = _seed(clean, 5)
    seen: list[str] = []
    cursor: str | None = None
    for _ in range(5):
        params: dict[str, str | int] = {"limit": 2} | ({"cursor": cursor} if cursor else {})
        page = client.get(JOBS, params=params).json()
        for item in page["items"]:
            parity.assert_valid(item, "DataJob")
        seen += [item["id"] for item in page["items"]]
        cursor = page["nextCursor"]
        if cursor is None:
            break

    assert seen == expected


def test_the_list_can_keep_one_job_type(client: TestClient, clean: Engine) -> None:
    _seed(clean, 3)
    with Session(clean) as db:
        queue_instrument_sync(db)
        db.commit()

    syncs = client.get(JOBS, params={"type": "instrument_sync", "limit": 1}).json()["items"]

    assert [job["type"] for job in syncs] == ["instrument_sync"]
    assert client.get(JOBS, params={"type": "nope"}).status_code == 400


def test_one_job_and_not_found(client: TestClient, clean: Engine) -> None:
    _seed(clean, 1)

    job = client.get(f"{JOBS}/job_00").json()
    assert job["from"] == "2026-01-01" and job["to"] == "2026-06-30"
    assert job["progressPercent"] == 0
    assert client.get(f"{JOBS}/job_nope").status_code == 404


BODY = {"symbols": ["infy", "TCS"], "timeframe": "1d", "from": "2025-01-01", "to": "2025-12-31"}


def test_create_queues_a_download_and_audits_the_caller(
    client: TestClient, clean: Engine, parity: Parity
) -> None:
    response = client.post(JOBS, json=BODY)

    assert response.status_code == 201
    job = response.json()
    parity.assert_valid(job, "DataJob")
    assert job["status"] == "queued" and job["symbols"] == ["INFY", "TCS"]
    assert job["segment"] == "equity_delivery"
    with Session(clean) as db:
        entry = db.scalars(select(AuditEntry)).one()
    assert entry.action == "data_job.create" and entry.target_id == job["id"]
    assert entry.actor_id == "usr_owner" and entry.actor_name == "Aarav Sharma"


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"symbols": ["NOPE"]}, "NOPE"),
        ({"from": "2026-01-01", "to": "2025-01-01"}, None),
        ({"symbols": [f"S{i}" for i in range(201)]}, None),
    ],
)
def test_create_rejects_bad_bodies(
    client: TestClient, change: dict[str, object], message: str | None
) -> None:
    response = client.post(JOBS, json=BODY | change)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"
    if message:
        assert message in response.json()["error"]["message"]


def test_cancel_a_queued_job_ends_it(client: TestClient, clean: Engine, parity: Parity) -> None:
    _seed(clean, 1)

    response = client.post(f"{JOBS}/job_00/cancel")

    assert response.status_code == 200
    job = response.json()
    parity.assert_valid(job, "DataJob")
    assert job["status"] == "cancelled" and job["finishedAt"] is not None
    with Session(clean) as db:
        entry = db.scalars(select(AuditEntry)).one()
    assert (
        entry.action == "data_job.cancel"
        and entry.summary == "Cancelled 1d download of 1 symbol(s)"
    )


def test_cancel_a_running_job_leaves_the_end_to_the_worker(
    client: TestClient, clean: Engine
) -> None:
    _seed(clean, 1)
    with Session(clean) as db:
        db.execute(update(DataJob).values(status="running", started_at=datetime.now(UTC)))
        db.commit()

    job = client.post(f"{JOBS}/job_00/cancel").json()

    assert job["status"] == "cancelled" and job["finishedAt"] is None


@pytest.mark.parametrize("status", ["completed", "failed", "cancelled"])
def test_cancel_a_finished_job_is_refused(client: TestClient, clean: Engine, status: str) -> None:
    _seed(clean, 1)
    now = datetime.now(UTC)
    values: dict[str, object] = {"status": status, "started_at": now, "finished_at": now}
    if status == "completed":
        values["progress_percent"] = 100
    if status == "failed":
        values["error"] = "boom"
    with Session(clean) as db:
        db.execute(update(DataJob).values(**values))
        db.commit()

    response = client.post(f"{JOBS}/job_00/cancel")

    assert response.status_code == 400
    assert response.json()["error"]["message"] == f"Job is already {status}"


def test_cancel_unknown_and_unauthorised(client: TestClient) -> None:
    assert client.post(f"{JOBS}/job_nope/cancel").status_code == 404
    headers = {"x-nova-internal-token": "nope"}
    assert client.post(JOBS, json=BODY, headers=headers).status_code == 401
    assert client.post(f"{JOBS}/job_nope/cancel", headers=headers).status_code == 401
