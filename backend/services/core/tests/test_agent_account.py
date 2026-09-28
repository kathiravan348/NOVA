from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from nova_core.main import create_app
from nova_core.settings import CoreSettings
from nova_db.models import AuditEntry, AuthSession
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

ACCOUNT = {
    "name": "Debug Agent",
    "email": "new-agent@example.com",
    "password": "long test password",
}


@pytest.fixture
def agent_client(
    core_settings: CoreSettings, agent: str, agent_credentials: dict[str, str]
) -> Iterator[TestClient]:
    with TestClient(create_app(core_settings)) as client:
        assert client.post("/api/v1/auth/login", json=agent_credentials).status_code == 200
        yield client


def test_create_get_and_single_account(signed_in: TestClient, engine: Engine) -> None:
    assert signed_in.get("/api/v1/agent").status_code == 404
    response = signed_in.post("/api/v1/agent", json=ACCOUNT)
    assert response.status_code == 201
    assert response.json()["enabled"] is True
    assert "password" not in response.json()
    assert signed_in.get("/api/v1/agent").json() == response.json()
    assert (
        signed_in.post("/api/v1/agent", json=ACCOUNT | {"email": "other@example.com"}).status_code
        == 400
    )
    with Session(engine) as db:
        assert db.scalar(select(AuditEntry.action).where(AuditEntry.action == "agent.create"))
    assert (
        signed_in.post(
            "/api/v1/auth/login", json={"email": ACCOUNT["email"], "password": ACCOUNT["password"]}
        ).json()["role"]
        == "agent"
    )


@pytest.mark.parametrize(
    "body",
    [
        ACCOUNT | {"password": "short"},
        ACCOUNT | {"email": "ADMIN@example.com"},
        ACCOUNT | {"email": "invalid"},
        ACCOUNT | {"unexpected": True},
    ],
)
def test_bad_creation_input(signed_in: TestClient, body: dict[str, object]) -> None:
    assert signed_in.post("/api/v1/agent", json=body).status_code == 400
    assert signed_in.get("/api/v1/agent").status_code == 404


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("GET", "/agent", None),
        ("POST", "/agent", ACCOUNT),
        ("PUT", "/agent/password", {"password": "another test password"}),
        ("PATCH", "/agent", {"enabled": False}),
    ],
)
def test_agent_cannot_manage_account(
    agent_client: TestClient, method: str, path: str, body: dict[str, object] | None
) -> None:
    assert agent_client.request(method, "/api/v1" + path, json=body).status_code == 403


def test_disable_revokes_sessions_and_enable_allows_new_login(
    signed_in: TestClient,
    agent_client: TestClient,
    agent: str,
    engine: Engine,
    agent_credentials: dict[str, str],
) -> None:
    assert signed_in.patch("/api/v1/agent", json={"enabled": False}).json()["enabled"] is False
    assert agent_client.get("/api/v1/me").status_code == 401
    assert agent_client.post("/api/v1/auth/login", json=agent_credentials).status_code == 401
    with Session(engine) as db:
        assert not db.scalars(select(AuthSession).where(AuthSession.user_id == agent)).all()
        assert (
            db.scalar(select(AuditEntry.summary).where(AuditEntry.action == "agent.access"))
            == "Agent access off"
        )
    assert signed_in.get("/api/v1/me").status_code == 200
    assert signed_in.patch("/api/v1/agent", json={"enabled": True}).json()["enabled"] is True
    assert agent_client.get("/api/v1/me").status_code == 401
    assert agent_client.post("/api/v1/auth/login", json=agent_credentials).status_code == 200


def test_password_revokes_all_sessions(
    signed_in: TestClient,
    agent_client: TestClient,
    agent: str,
    engine: Engine,
    agent_credentials: dict[str, str],
    core_settings: CoreSettings,
) -> None:
    with TestClient(create_app(core_settings)) as other:
        assert other.post("/api/v1/auth/login", json=agent_credentials).status_code == 200
        assert (
            signed_in.put("/api/v1/agent/password", json={"password": "short"}).status_code == 400
        )
        assert agent_client.get("/api/v1/me").status_code == 200
        assert (
            signed_in.put(
                "/api/v1/agent/password", json={"password": "new long password"}
            ).status_code
            == 200
        )
        assert other.get("/api/v1/me").status_code == 401
    assert agent_client.get("/api/v1/me").status_code == 401
    assert agent_client.post("/api/v1/auth/login", json=agent_credentials).status_code == 401
    assert (
        agent_client.post(
            "/api/v1/auth/login", json=agent_credentials | {"password": "new long password"}
        ).status_code
        == 200
    )
    with Session(engine) as db:
        assert db.scalar(select(AuditEntry.action).where(AuditEntry.action == "agent.password"))


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("PUT", "/agent/password", {"password": "long test password"}),
        ("PATCH", "/agent", {"enabled": False}),
    ],
)
def test_missing_agent(
    signed_in: TestClient, method: str, path: str, body: dict[str, object]
) -> None:
    assert signed_in.request(method, "/api/v1" + path, json=body).status_code == 404
