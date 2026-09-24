from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from nova_db.models import AuditEntry
from nova_testing.parity import Parity
from sqlalchemy import Engine
from sqlalchemy.orm import Session

AUDIT = "/api/v1/audit"


@pytest.fixture
def entries(signed_in: TestClient, engine: Engine) -> list[str]:
    """Seven entries in total (the sign-in plus six added here), returned newest first."""
    base = datetime(2026, 9, 1, tzinfo=UTC)
    with Session(engine) as db:
        for i in range(6):
            db.add(
                AuditEntry(
                    id=f"aud_seed_{i}",
                    at=base + timedelta(minutes=i),
                    actor_name="System",
                    action="backtest.run",
                    target_type="backtest",
                    target_id=f"run_{i}",
                    summary=f"Entry {i}",
                )
            )
        db.commit()
    return [f"aud_seed_{i}" for i in reversed(range(6))]


def test_audit_needs_a_session(client: TestClient) -> None:
    assert client.get(AUDIT).status_code == 401


def test_pages_walk_every_entry_once_newest_first(
    signed_in: TestClient, entries: list[str], parity: Parity
) -> None:
    seen: list[str] = []
    cursor: str | None = None
    for _ in range(10):
        params: dict[str, str | int] = {"limit": 2} | ({"cursor": cursor} if cursor else {})
        page = signed_in.get(AUDIT, params=params).json()
        for item in page["items"]:
            parity.assert_valid(item, "AuditEntry")
        seen.extend(item["id"] for item in page["items"])
        cursor = page["nextCursor"]
        if cursor is None:
            break

    assert len(seen) == 7 and len(set(seen)) == 7
    assert seen[1:] == entries  # the sign-in entry is the newest


def test_default_page_holds_everything(signed_in: TestClient, entries: list[str]) -> None:
    page = signed_in.get(AUDIT).json()

    assert len(page["items"]) == 7
    assert page["nextCursor"] is None


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 201}, {"cursor": "bm9wZQ"}])
def test_bad_paging_is_invalid_request(signed_in: TestClient, params: dict[str, str | int]) -> None:
    response = signed_in.get(AUDIT, params=params)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"
