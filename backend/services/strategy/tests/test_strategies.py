import pytest
from fastapi.testclient import TestClient
from nova_db.models import AuditEntry
from nova_testing.parity import Parity
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

STRATEGIES = "/api/v1/strategies"


def _create(client: TestClient, spec: dict[str, object], name: str = "VWAP") -> dict[str, object]:
    response = client.post(STRATEGIES, json={"name": name, "description": "Test", "spec": spec})
    assert response.status_code == 201
    body: dict[str, object] = response.json()
    return body


def test_needs_the_internal_token(client: TestClient) -> None:
    assert client.get(STRATEGIES, headers={"x-nova-internal-token": "nope"}).status_code == 401


def test_create_version_update_flow(
    client: TestClient, spec: dict[str, object], parity: Parity, clean: Engine
) -> None:
    created = _create(client, spec)
    parity.assert_valid(created, "Strategy")
    assert created["status"] == "draft" and created["latestVersion"] == 1
    strategy_id = str(created["id"])

    python_spec = spec | {"mode": "python", "code": "class Strategy: ..."}
    python_spec.pop("entry")
    python_spec.pop("exit")
    versioned = client.post(
        f"{STRATEGIES}/{strategy_id}/versions", json={"note": "Python rewrite", "spec": python_spec}
    )
    assert versioned.status_code == 201
    body = versioned.json()
    parity.assert_valid(body, "Strategy")
    assert body["latestVersion"] == 2
    assert [v["spec"]["mode"] for v in body["versions"]] == ["visual", "python"]
    assert body["versions"][0]["spec"] == spec  # version 1 is untouched

    updated = client.patch(
        f"{STRATEGIES}/{strategy_id}", json={"status": "active", "name": "VWAP 2"}
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "active" and updated.json()["name"] == "VWAP 2"

    assert client.get(f"{STRATEGIES}/{strategy_id}").json() == updated.json()
    assert [s["id"] for s in client.get(STRATEGIES).json()] == [strategy_id]
    with Session(clean) as db:
        summaries = list(db.scalars(select(AuditEntry.summary).order_by(AuditEntry.at)))
    assert summaries == [
        "Created strategy VWAP",
        "Saved version 2 of VWAP",
        "Updated VWAP 2: name, status active",
    ]


@pytest.mark.parametrize(
    ("method", "path", "body", "status"),
    [
        ("post", "", {"name": "", "description": "", "spec": {}}, 400),
        ("post", "/stg_nope/versions", {"note": "", "spec": None}, 400),
        ("patch", "/stg_nope", {"status": "active"}, 404),
        ("get", "/stg_nope", None, 404),
    ],
)
def test_bad_requests(
    client: TestClient, method: str, path: str, body: dict[str, object] | None, status: int
) -> None:
    response = client.request(method.upper(), f"{STRATEGIES}{path}", json=body)

    assert response.status_code == status


def test_empty_or_unknown_update_is_refused(client: TestClient, spec: dict[str, object]) -> None:
    strategy_id = _create(client, spec)["id"]

    assert client.patch(f"{STRATEGIES}/{strategy_id}", json={}).status_code == 400
    assert (
        client.patch(f"{STRATEGIES}/{strategy_id}", json={"status": "deleted"}).status_code == 400
    )
