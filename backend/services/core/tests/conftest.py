from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from nova_core.cli import create_admin
from nova_core.main import create_app
from nova_core.passwords import hash_password
from nova_core.settings import CoreSettings
from nova_db.models import User, UserRole
from nova_testing.db import database_url, engine, session
from nova_testing.parity import Parity
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

__all__ = ["database_url", "engine", "session"]

INTERNAL_TOKEN = "test-internal-token"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "correct horse battery"
AGENT_EMAIL = "agent@example.com"
AGENT_PASSWORD = "agent test password"


@pytest.fixture(scope="session")
def agent_credentials() -> dict[str, str]:
    return {"email": AGENT_EMAIL, "password": AGENT_PASSWORD}


def make_settings(database: str, **overrides: object) -> CoreSettings:
    values: dict[str, object] = {
        "database_url": database,
        "redis_url": "redis://unused:6379/0",
        "internal_token": INTERNAL_TOKEN,
    }
    return CoreSettings.model_validate(values | overrides)


@pytest.fixture
def dummy_settings() -> CoreSettings:
    """For routes that never touch the database."""
    return make_settings("postgresql+psycopg://nobody:none@127.0.0.1:1/none")


@pytest.fixture
def core_settings(database_url: str, engine: Engine) -> CoreSettings:
    return make_settings(database_url, broker_url="http://broker:8001")


@pytest.fixture
def admin(engine: Engine) -> str:
    """A clean database with one super-admin; returns the admin's id."""
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE users, auth_sessions, audit_entries CASCADE"))
    with Session(engine) as db:
        user = create_admin(db, email=ADMIN_EMAIL, name="Aarav Sharma", password=ADMIN_PASSWORD)
        db.commit()
        return user.id


@pytest.fixture
def client(core_settings: CoreSettings, admin: str) -> Iterator[TestClient]:
    with TestClient(create_app(core_settings)) as test_client:
        yield test_client


@pytest.fixture
def signed_in(client: TestClient) -> TestClient:
    response = client.post(
        "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200
    return client


@pytest.fixture
def agent(engine: Engine, admin: str) -> str:
    with Session(engine) as db:
        db.add(
            User(
                id="usr_agent",
                name="Debug Agent",
                email=AGENT_EMAIL,
                password_hash=hash_password(AGENT_PASSWORD),
            )
        )
        db.flush()
        db.add(UserRole(user_id="usr_agent", role_id="agent"))
        db.commit()
    return "usr_agent"


@pytest.fixture(scope="session")
def parity() -> Parity:
    return Parity()


@pytest.fixture(scope="session")
def credentials() -> dict[str, str]:
    """The seeded admin's login body."""
    return {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}


@pytest.fixture(scope="session")
def internal_token() -> str:
    return INTERNAL_TOKEN
