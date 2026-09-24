"""Kite data endpoints for other services (D41): internal token, live session, limiter slot."""

import time
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from nova_broker.crypto import TokenCipher
from nova_broker.settings import BrokerSettings
from nova_db.models import BrokerAccount, BrokerSession, RateLimitRule
from nova_testing.kite import ACCESS_TOKEN, FakeKite
from sqlalchemy import Engine, update
from sqlalchemy.orm import Session

HISTORY = "/internal/kite/historical"
PARAMS: dict[str, str | int] = {
    "instrument_token": 408065,
    "interval": "day",
    "start": "2026-09-21T00:00:00+05:30",
    "end": "2026-09-25T00:00:00+05:30",
}


@pytest.fixture
def service(app: FastAPI) -> TestClient:
    """A client that sends only the internal token, as Atlas does."""
    return TestClient(app, headers={"x-nova-internal-token": "internal-test-token"})


@pytest.fixture
def live(account_id: str, clean: Engine, settings: BrokerSettings) -> str:
    assert settings.broker_token_key is not None
    cipher = TokenCipher(settings.broker_token_key.get_secret_value())
    now = datetime.now(UTC)
    with Session(clean) as db:
        db.add(
            BrokerSession(
                account_id=account_id,
                access_token_encrypted=cipher.encrypt(ACCESS_TOKEN),
                logged_in_at=now - timedelta(hours=1),
                expires_at=now + timedelta(hours=8),
            )
        )
        db.commit()
    return account_id


def test_needs_the_internal_token(app: FastAPI, live: str) -> None:
    with TestClient(app) as anonymous:
        assert anonymous.get(HISTORY, params=PARAMS).status_code == 401


def test_without_a_live_session_asks_for_a_kite_login(service: TestClient, account_id: str) -> None:
    response = service.get(HISTORY, params=PARAMS)

    assert response.status_code == 400
    assert "Log in to Kite in Relay first" in response.json()["error"]["message"]


def test_disabled_accounts_are_not_used(service: TestClient, live: str, clean: Engine) -> None:
    with Session(clean) as db:
        db.execute(update(BrokerAccount).values(enabled=False))
        db.commit()

    assert service.get(HISTORY, params=PARAMS).status_code == 400


def test_instrument_dump_is_passed_through(service: TestClient, live: str, kite: FakeKite) -> None:
    response = service.get("/internal/kite/instruments/NSE")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "INFY" in response.text
    assert kite.requests[-1].headers["authorization"] == f"token kitekeyAB12:{ACCESS_TOKEN}"
    assert service.get("/internal/kite/instruments/BSE").status_code == 400


def test_historical_returns_kite_candles(service: TestClient, live: str, kite: FakeKite) -> None:
    body = service.get(HISTORY, params=PARAMS).json()

    assert [bar[0] for bar in body["candles"]] == [
        f"2026-09-{day}T00:00:00+0530" for day in (21, 22, 23, 24, 25)
    ]
    sent = kite.requests[-1]
    assert sent.url.path == "/instruments/historical/408065/day"
    assert sent.url.params["from"] == "2026-09-21 00:00:00"


@pytest.mark.parametrize(
    "change",
    [
        {"interval": "2minute"},
        {"start": "2026-09-21T00:00:00"},
        {"start": "2026-09-26T00:00:00+05:30"},
    ],
)
def test_bad_history_requests_are_refused(
    service: TestClient, live: str, change: dict[str, str | int]
) -> None:
    assert service.get(HISTORY, params=PARAMS | change).status_code == 400


def test_calls_wait_for_a_limiter_slot(
    service: TestClient, app: FastAPI, live: str, clean: Engine
) -> None:
    with Session(clean) as db:
        db.execute(
            update(RateLimitRule).where(RateLimitRule.endpoint == "historical").values(nova_limit=1)
        )
        db.commit()
    waits: list[float] = []

    def sleep(seconds: float) -> None:
        waits.append(seconds)
        time.sleep(seconds)

    app.state.sleep = sleep
    assert service.get(HISTORY, params=PARAMS).status_code == 200
    assert service.get(HISTORY, params=PARAMS).status_code == 200

    assert len(waits) == 1 and 0 < waits[0] <= 1
