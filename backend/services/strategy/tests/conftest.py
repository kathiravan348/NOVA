from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from nova_db.models import User
from nova_strategy.main import create_app
from nova_strategy.settings import StrategySettings
from nova_testing.db import database_url, engine, session
from nova_testing.parity import Parity
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

__all__ = ["database_url", "engine", "session"]

TOKEN = "internal-test-token"


@pytest.fixture
def clean(engine: Engine) -> Engine:
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE strategies, audit_entries, users CASCADE"))
    with Session(engine) as db:
        db.add(User(id="usr_owner", name="Aarav Sharma", email="a@example.com", password_hash="x"))
        db.commit()
    return engine


@pytest.fixture
def client(database_url: str, clean: Engine) -> Iterator[TestClient]:
    settings = StrategySettings.model_validate(
        {
            "database_url": database_url,
            "redis_url": "redis://unused:6379/0",
            "internal_token": TOKEN,
        }
    )
    headers = {
        "x-nova-internal-token": TOKEN,
        "x-nova-user-id": "usr_owner",
        "x-nova-user-name": "Aarav%20Sharma",
    }
    with TestClient(create_app(settings), headers=headers) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def parity() -> Parity:
    return Parity()


@pytest.fixture
def spec(parity: Parity) -> dict[str, object]:
    """A visual spec from the mocks."""
    spec: dict[str, object] = parity.mock("strategies")[0]["versions"][1]["spec"]
    return spec
