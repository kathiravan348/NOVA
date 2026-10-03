from collections.abc import Iterator
from datetime import UTC, datetime

import httpx2
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from nova_core.deps import require_admin
from nova_core.main import create_app
from nova_core.settings import CoreSettings
from nova_db.models import ApprovalRequest, AuditEntry, User
from nova_testing.parity import Parity
from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session


@pytest.fixture
def sent() -> list[httpx2.Request]:
    return []


@pytest.fixture
def agent_client(
    core_settings: CoreSettings,
    agent: str,
    sent: list[httpx2.Request],
    agent_credentials: dict[str, str],
) -> Iterator[TestClient]:
    settings = core_settings.model_copy(
        update={
            "strategy_url": "http://strategy:8003",
            "atlas_url": "http://atlas:8002",
            "backtest_url": "http://backtest:8004",
        }
    )

    def handle(request: httpx2.Request) -> httpx2.Response:
        sent.append(request)
        return httpx2.Response(200, json={"ok": True})

    app = create_app(settings, upstream_transport=httpx2.MockTransport(handle))

    @app.get("/admin-test", dependencies=[Depends(require_admin)])
    def admin_test() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(app) as client:
        assert client.post("/api/v1/auth/login", json=agent_credentials).status_code == 200
        yield client


@pytest.mark.parametrize(
    "prefix", ["strategies", "backtests", "research-profiles", "market-data", "data-jobs"]
)
def test_agent_reads_pass(
    agent_client: TestClient, sent: list[httpx2.Request], prefix: str
) -> None:
    assert agent_client.get(f"/api/v1/{prefix}?q=1&q=2").status_code == 200
    assert len(sent) == 1
    assert sent[0].headers["x-nova-user-id"] == "usr_agent"
    assert sent[0].url.query == b"q=1&q=2"
    assert "cookie" not in sent[0].headers


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("POST", "/backtests", {"name": "Test"}),
        ("POST", "/research-profiles/rp_1/versions/1/freeze", None),
        ("PUT", "/strategies/stg_1", {"name": "Test"}),
        ("PATCH", "/market-data/universe/INFY", {"sector": "IT"}),
        ("DELETE", "/data-jobs/job_1", None),
    ],
)
def test_agent_writes_are_held(
    agent_client: TestClient,
    sent: list[httpx2.Request],
    engine: Engine,
    parity: Parity,
    method: str,
    path: str,
    body: dict[str, str] | None,
) -> None:
    response = agent_client.request(method, f"/api/v1{path}?x=1&x=2", json=body)
    assert response.status_code == 202
    parity.assert_valid(response.json(), "ApprovalRequest")
    assert sent == []
    approval = response.json()
    assert response.headers["x-nova-approval"] == approval["id"]
    assert approval["status"] == "pending" and approval["agentName"] == "Debug Agent"
    assert approval["path"] == path and approval["query"] == "x=1&x=2"
    assert approval["body"] == body
    with Session(engine) as db:
        row = db.get(ApprovalRequest, approval["id"])
        assert row is not None and row.agent_id == "usr_agent" and row.method == method
        audit = db.scalars(select(AuditEntry).where(AuditEntry.action == "approval.request")).one()
        assert audit.actor_id == row.agent_id and audit.target_id == row.id
        assert (
            audit.target_type == "approval_request" and audit.summary == f"Asked: {method} {path}"
        )


@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE"])
@pytest.mark.parametrize(
    "path",
    [
        "/broker/accounts",
        "/future-service",
        "/agent-account",
        "/approvals/apr_1/approve",
        "/approvals/apr_1/reject",
    ],
)
def test_blocked_requests_never_reach_services(
    agent_client: TestClient, sent: list[httpx2.Request], engine: Engine, method: str, path: str
) -> None:
    response = agent_client.request(method, f"/api/v1{path}", json={})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"
    assert sent == []
    with Session(engine) as db:
        assert db.scalars(select(ApprovalRequest)).all() == []


def test_plan_is_a_free_write(agent_client: TestClient, sent: list[httpx2.Request]) -> None:
    assert (
        agent_client.post("/api/v1/data-jobs/plan", json={"symbols": ["INFY"]}).status_code == 200
    )
    assert len(sent) == 1 and sent[0].method == "POST"


@pytest.mark.parametrize(
    "body,content_type",
    [
        (b"bad", "application/json"),
        (b"{}", "text/plain"),
        (b"NaN", "application/json"),
        (b'"' + b"x" * 65535 + b'"', "application/json"),
    ],
)
def test_invalid_or_large_bodies_are_not_stored(
    agent_client: TestClient,
    engine: Engine,
    sent: list[httpx2.Request],
    body: bytes,
    content_type: str,
) -> None:
    assert (
        agent_client.post(
            "/api/v1/backtests", content=body, headers={"content-type": content_type}
        ).status_code
        == 400
    )
    assert sent == []
    with Session(engine) as db:
        assert db.scalars(select(ApprovalRequest)).all() == []


def test_exact_body_limit_is_accepted(agent_client: TestClient) -> None:
    response = agent_client.post(
        "/api/v1/backtests",
        content=b'"' + b"x" * 65534 + b'"',
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 202


def test_agent_local_access(agent_client: TestClient) -> None:
    assert agent_client.get("/api/v1/me").json()["role"] == "agent"
    assert agent_client.get("/api/v1/audit").status_code == 200
    assert agent_client.get("/admin-test").status_code == 403
    with agent_client.websocket_connect("/api/v1/ws") as socket:
        assert socket.receive_json() == {"type": "hello"}
    assert agent_client.post("/api/v1/auth/logout").status_code == 204
    assert agent_client.get("/api/v1/me").status_code == 401


def test_disabled_agent_loses_existing_session(
    agent_client: TestClient, engine: Engine, sent: list[httpx2.Request]
) -> None:
    with Session(engine) as db:
        db.execute(update(User).where(User.id == "usr_agent").values(disabled_at=datetime.now(UTC)))
        db.commit()
    assert agent_client.get("/api/v1/me").status_code == 401
    assert agent_client.get("/api/v1/backtests").status_code == 401
    assert sent == []
