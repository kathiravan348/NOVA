"""Broker test fixtures. Kite is always fake (D35): `nova_testing.kite.FakeKite`."""

from collections.abc import Iterator

import httpx2
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from nova_broker.cli import add_account
from nova_broker.crypto import new_key
from nova_broker.main import create_app
from nova_broker.settings import BrokerSettings
from nova_db.models import User
from nova_testing.db import database_url, engine, session
from nova_testing.kite import API_KEY, API_SECRET, FakeKite
from nova_testing.parity import Parity
from nova_testing.redis import redis_client
from redis import Redis
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

__all__ = ["database_url", "engine", "redis_client", "session"]

TOKEN = "internal-test-token"


def make_settings(database: str, **overrides: object) -> BrokerSettings:
    values: dict[str, object] = {
        "database_url": database,
        "redis_url": "redis://unused:6379/0",
        "internal_token": TOKEN,
        "kite_api_key": API_KEY,
        "kite_api_secret": API_SECRET,
        "broker_token_key": new_key(),
        "relay_url": "http://relay.test",
    }
    return BrokerSettings.model_validate(values | overrides)


@pytest.fixture
def kite() -> FakeKite:
    return FakeKite()


@pytest.fixture
def clean(engine: Engine) -> Engine:
    """Empty broker tables plus one user to act as the caller."""
    with engine.begin() as connection:
        connection.execute(
            text("TRUNCATE broker_accounts, broker_profiles, audit_entries, users CASCADE")
        )
    with Session(engine) as db:
        db.add(User(id="usr_owner", name="Aarav Sharma", email="a@example.com", password_hash="x"))
        db.commit()
    return engine


@pytest.fixture
def account_id(clean: Engine) -> str:
    with Session(clean) as db:
        account = add_account(db, label="Primary", client_id="AB1234")
        db.commit()
        return account.id


@pytest.fixture
def settings(database_url: str, clean: Engine) -> BrokerSettings:
    return make_settings(database_url)


@pytest.fixture(scope="session")
def caller_headers() -> dict[str, str]:
    """What NOVA Core sends for the signed-in owner (D38)."""
    return {
        "x-nova-internal-token": TOKEN,
        "x-nova-user-id": "usr_owner",
        "x-nova-user-name": "Aarav%20Sharma",
    }


@pytest.fixture
def app(settings: BrokerSettings, kite: FakeKite, redis_client: Redis) -> FastAPI:
    return create_app(
        settings, kite_transport=httpx2.MockTransport(kite.handle), redis=redis_client
    )


@pytest.fixture
def client(app: FastAPI, caller_headers: dict[str, str]) -> Iterator[TestClient]:
    with TestClient(app, headers=caller_headers, follow_redirects=False) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def parity() -> Parity:
    return Parity()
