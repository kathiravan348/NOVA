"""Atlas fixtures: a throwaway database and `FakeBroker` (Atlas never reaches Kite, D35, D41)."""

from collections.abc import Iterator
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from nova_atlas.broker_client import BrokerData
from nova_atlas.main import create_app
from nova_atlas.settings import AtlasSettings
from nova_db.models import UniverseEntry, User
from nova_testing.broker import FakeBroker
from nova_testing.db import database_url, engine, session
from nova_testing.parity import Parity
from sqlalchemy import Engine, insert, select, text
from sqlalchemy.orm import Session, sessionmaker

__all__ = ["database_url", "engine", "session"]

TOKEN = "internal-test-token"


@pytest.fixture
def fake_broker() -> FakeBroker:
    return FakeBroker(TOKEN)


def _fake_client(fake_broker: FakeBroker) -> BrokerData:
    return BrokerData(
        "http://broker:8000", TOKEN, transport=httpx2.MockTransport(fake_broker.handle)
    )


@pytest.fixture
def broker(fake_broker: FakeBroker) -> Iterator[BrokerData]:
    client = _fake_client(fake_broker)
    yield client
    client.close()


@pytest.fixture(scope="session")
def seeded_universe(engine: Engine) -> list[dict[str, Any]]:
    """The stock list as migration 0006 seeds it. Any: column values by name."""
    with Session(engine) as db:
        return [
            {c: getattr(row, c) for c in ("exchange", "symbol", "name", "sector", "indices")}
            for row in db.scalars(select(UniverseEntry))
        ]


@pytest.fixture
def clean(engine: Engine, seeded_universe: list[dict[str, Any]]) -> Engine:
    with engine.begin() as connection:
        connection.execute(
            text(
                "TRUNCATE data_jobs, instruments, candles, ticks, audit_entries, users, universe"
                " CASCADE"
            )
        )
        connection.execute(insert(UniverseEntry), seeded_universe)
    with Session(engine) as db:
        db.add(User(id="usr_owner", name="Aarav Sharma", email="a@example.com", password_hash="x"))
        db.commit()
    return engine


@pytest.fixture
def factory(clean: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=clean, expire_on_commit=False)


@pytest.fixture
def client(database_url: str, clean: Engine, fake_broker: FakeBroker) -> Iterator[TestClient]:
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
    app = create_app(settings, broker_factory=lambda: _fake_client(fake_broker))
    with TestClient(app, headers=headers) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def parity() -> Parity:
    return Parity()
