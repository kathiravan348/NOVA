import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Event

import httpx2
import pytest
from fastapi.testclient import TestClient
from nova_contracts import ApprovalRequest as ApprovalContract
from nova_core.main import create_app
from nova_core.settings import CoreSettings
from nova_db.models import ApprovalRequest, AuditEntry, User, UserRole
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session


def seed(
    engine: Engine, agent: str, *, age: int = 0, claimed: bool = False, row_id: str = "apr_test"
) -> str:
    with Session(engine) as db:
        db.add(
            ApprovalRequest(
                id=row_id,
                agent_id=agent,
                method="POST",
                path="/backtests",
                query="source=test",
                body={"strategyId": "str_test"},
                status="pending",
                created_at=datetime.now(UTC) - timedelta(minutes=age),
                decided_at=datetime.now(UTC) if claimed else None,
            )
        )
        db.commit()
    return row_id


@pytest.mark.parametrize("status", [201, 204, 400, 500])
def test_replay_and_result(
    core_settings: CoreSettings,
    admin: str,
    agent: str,
    engine: Engine,
    credentials: dict[str, str],
    status: int,
) -> None:
    approval_id = seed(engine, agent)
    calls: list[httpx2.Request] = []

    def upstream(request: httpx2.Request) -> httpx2.Response:
        calls.append(request)
        return httpx2.Response(status, content="é" * 9000)

    settings = core_settings.model_copy(update={"backtest_url": "http://backtest:8000"})
    with TestClient(
        create_app(settings, upstream_transport=httpx2.MockTransport(upstream))
    ) as client:
        client.post("/api/v1/auth/login", json=credentials)
        response = client.post(f"/api/v1/approvals/{approval_id}/approve")
        assert response.status_code == 200
        contract = ApprovalContract.model_validate(response.json())
        assert contract.status == ("done" if status < 300 else "failed")
        assert contract.result_status == status
        assert contract.result_body == "é" * 8000
        assert contract.decided_by == admin
        assert contract.decided_at is not None
        assert client.post(f"/api/v1/approvals/{approval_id}/approve").status_code == 400
        assert client.post(f"/api/v1/approvals/{approval_id}/reject").status_code == 400
        assert client.get("/api/v1/approvals").json()["items"][0] == response.json()
    assert len(calls) == 1
    request = calls[0]
    assert request.url.path == "/api/v1/backtests"
    assert str(request.url.query, "utf-8") == "source=test"
    assert json.loads(request.content) == {"strategyId": "str_test"}
    assert request.headers["x-nova-user-id"] == agent
    assert request.headers["x-nova-user-name"] == "Debug%20Agent"
    with Session(engine) as db:
        audit = db.scalars(select(AuditEntry).where(AuditEntry.action == "approval.approve")).one()
        assert audit.summary == f"Approved POST /backtests → {status}"
        assert audit.actor_id == admin


def test_no_answer_is_stored_as_failed(
    core_settings: CoreSettings, agent: str, engine: Engine, credentials: dict[str, str]
) -> None:
    approval_id = seed(engine, agent)

    def upstream(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ConnectError("unavailable", request=request)

    settings = core_settings.model_copy(update={"backtest_url": "http://backtest:8000"})
    with TestClient(
        create_app(settings, upstream_transport=httpx2.MockTransport(upstream))
    ) as client:
        client.post("/api/v1/auth/login", json=credentials)
        result = client.post(f"/api/v1/approvals/{approval_id}/approve").json()
        assert result["status"] == "failed"
        assert result["resultStatus"] is None
        assert result["resultBody"] == "The backtests service did not answer"
        assert client.post(f"/api/v1/approvals/{approval_id}/approve").status_code == 400


def test_reject_and_expiry(signed_in: TestClient, agent: str, engine: Engine) -> None:
    seed(engine, agent)
    seed(engine, agent, age=31, row_id="apr_old")
    seed(engine, agent, age=31, claimed=True, row_id="apr_claimed")
    assert signed_in.post("/api/v1/approvals/apr_test/reject").json()["status"] == "rejected"
    assert signed_in.post("/api/v1/approvals/apr_test/reject").status_code == 400
    assert signed_in.post("/api/v1/approvals/apr_old/approve").status_code == 400
    assert signed_in.post("/api/v1/approvals/apr_old/reject").status_code == 400
    assert signed_in.post("/api/v1/approvals/missing/approve").status_code == 400
    assert signed_in.get("/api/v1/approvals?status=expired").json()["items"][0]["id"] == "apr_old"
    assert (
        signed_in.get("/api/v1/approvals?status=pending").json()["items"][0]["id"] == "apr_claimed"
    )
    with Session(engine) as db:
        assert db.scalar(select(AuditEntry.action).where(AuditEntry.action == "approval.reject"))


def test_agent_only_sees_own_and_cannot_decide(
    signed_in: TestClient, agent: str, engine: Engine, agent_credentials: dict[str, str]
) -> None:
    seed(engine, agent)
    with Session(engine) as db:
        db.add(
            User(id="usr_other", name="Other", email="other@example.com", password_hash="unused")
        )
        db.flush()
        db.add(UserRole(user_id="usr_other", role_id="agent"))
        db.commit()
    seed(engine, "usr_other", row_id="apr_other")
    assert len(signed_in.get("/api/v1/approvals").json()["items"]) == 2
    signed_in.post("/api/v1/auth/login", json=agent_credentials)
    assert [r["id"] for r in signed_in.get("/api/v1/approvals").json()["items"]] == ["apr_test"]
    for action in ("approve", "reject"):
        assert signed_in.post(f"/api/v1/approvals/apr_test/{action}").status_code == 403


def test_pages_and_filters(signed_in: TestClient, agent: str, engine: Engine) -> None:
    for number in range(3):
        seed(engine, agent, age=number, row_id=f"apr_{number}")
    page = signed_in.get("/api/v1/approvals?limit=2&status=pending").json()
    assert [r["id"] for r in page["items"]] == ["apr_0", "apr_1"]
    last = signed_in.get(
        "/api/v1/approvals", params={"limit": 2, "status": "pending", "cursor": page["nextCursor"]}
    ).json()
    assert [r["id"] for r in last["items"]] == ["apr_2"]
    assert last["nextCursor"] is None
    offset = signed_in.get("/api/v1/approvals?limit=2&status=pending&offset=2").json()
    assert offset == last
    assert page["total"] == last["total"] == 3
    assert signed_in.get("/api/v1/approvals?status=done&offset=0").json()["total"] == 0
    for query in ("status=invalid", "limit=0", "cursor=invalid"):
        assert signed_in.get("/api/v1/approvals?" + query).status_code == 400


def test_concurrent_decisions_cannot_replay_twice(
    core_settings: CoreSettings,
    agent: str,
    engine: Engine,
    credentials: dict[str, str],
) -> None:
    seed(engine, agent)
    entered, release = Event(), Event()
    calls: list[httpx2.Request] = []

    def upstream(request: httpx2.Request) -> httpx2.Response:
        calls.append(request)
        entered.set()
        assert release.wait(10)
        return httpx2.Response(201, json={"id": "btr_test"})

    settings = core_settings.model_copy(update={"backtest_url": "http://backtest:8000"})
    app = create_app(settings, upstream_transport=httpx2.MockTransport(upstream))
    with TestClient(app) as first, TestClient(create_app(settings)) as second:
        for client in (first, second):
            client.post("/api/v1/auth/login", json=credentials)
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(first.post, "/api/v1/approvals/apr_test/approve")
            try:
                assert entered.wait(10)
                assert second.post("/api/v1/approvals/apr_test/approve").status_code == 400
                assert second.post("/api/v1/approvals/apr_test/reject").status_code == 400
            finally:
                release.set()
            assert future.result().json()["status"] == "done"
    assert len(calls) == 1
