from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from nova_db.models import DataJob
from nova_testing.parity import Parity
from sqlalchemy import Engine
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


def test_one_job_and_not_found(client: TestClient, clean: Engine) -> None:
    _seed(clean, 1)

    job = client.get(f"{JOBS}/job_00").json()
    assert job["from"] == "2026-01-01" and job["to"] == "2026-06-30"
    assert job["progressPercent"] == 0
    assert client.get(f"{JOBS}/job_nope").status_code == 404
