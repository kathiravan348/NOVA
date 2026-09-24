"""Atlas fixtures: a throwaway database and `FakeBroker` (Atlas never reaches Kite, D35, D41)."""

from collections.abc import Iterator

import httpx2
import pytest
from fastapi.testclient import TestClient
from nova_atlas.broker_client import BrokerData
from nova_atlas.main import create_app
from nova_atlas.settings import AtlasSettings
from nova_db.models import User
from nova_testing.broker import FakeBroker
from nova_testing.db import database_url, engine, session
from nova_testing.parity import Parity
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session, sessionmaker

__all__ = ["database_url", "engine", "session"]

TOKEN = "internal-test-token"


@pytest.fixture
def fake_broker() -> FakeBroker:
    return FakeBroker(TOKEN)


@pytest.fixture
def broker(fake_broker: FakeBroker) -> Iterator[BrokerData]:
    client = BrokerData(
        "http://broker:8000", TOKEN, transport=httpx2.MockTransport(fake_broker.handle)
    )
    yield client
    client.close()


@pytest.fixture
def clean(engine: Engine) -> Engine:
    with engine.begin() as connection:
        connection.execute(
            text("TRUNCATE data_jobs, instruments, candles, audit_entries, users CASCADE")
        )
    with Session(engine) as db:
        db.add(User(id="usr_owner", name="Aarav Sharma", email="a@example.com", password_hash="x"))
        db.commit()
    return engine


@pytest.fixture
def factory(clean: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=clean, expire_on_commit=False)


@pytest.fixture
def client(database_url: str, clean: Engine) -> Iterator[TestClient]:
    settings = AtlasSettings.model_validate(
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
