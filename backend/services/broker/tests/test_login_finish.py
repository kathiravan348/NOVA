"""The daily Kite login, second half: the passphrase opens the secret for one exchange (D55)."""

from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from nova_broker import pending_login
from nova_broker.crypto import TokenCipher
from nova_broker.settings import BrokerSettings
from nova_db.models import AuditEntry, BrokerSession
from nova_testing.kite import ACCESS_TOKEN, API_SECRET, PASSPHRASE, FakeKite
from nova_testing.parity import Parity
from redis import Redis
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

CALLBACK = "/api/v1/broker/kite/callback"


def start(client: TestClient, account_id: str) -> str:
    response = client.get(f"/api/v1/broker/accounts/{account_id}/login")
    query = parse_qs(urlparse(response.headers["location"]).query)
    return parse_qs(query["redirect_params"][0])["state"][0]


def summaries(engine: Engine) -> list[str]:
    with Session(engine) as db:
        rows = db.scalars(
            select(AuditEntry).where(AuditEntry.action == "broker.login").order_by(AuditEntry.at)
        )
        return [row.summary for row in rows]


@pytest.fixture
def pending(client: TestClient, account_id: str) -> str:
    """A login that came back from Kite and waits for the passphrase; returns the account id."""
    state = start(client, account_id)
    client.get(CALLBACK, params={"state": state, "status": "success", "request_token": "req-1"})
    return account_id


def finish(client: TestClient, account_id: str, passphrase: str = PASSPHRASE) -> dict[str, object]:
    response = client.post(
        f"/api/v1/broker/accounts/{account_id}/login/finish", json={"passphrase": passphrase}
    )
    return {"status": response.status_code, "body": response.json(), "text": response.text}


def _message(result: dict[str, object]) -> str:
    body = result["body"]
    assert isinstance(body, dict)
    return str(body["error"]["message"])


def test_finish_saves_the_encrypted_token_until_0600_ist(
    client: TestClient,
    pending: str,
    clean: Engine,
    settings: BrokerSettings,
    redis_client: Redis,
    parity: Parity,
    kite: FakeKite,
) -> None:
    result = finish(client, pending)

    assert result["status"] == 200
    parity.assert_valid(result["body"], "BrokerAccount")
    body = result["body"]
    # The fake Kite logs in on 2026-09-24, so the session already shows as expired today.
    assert isinstance(body, dict) and body["session"]["status"] != "not_logged_in"
    assert API_SECRET not in str(result["text"]) and PASSPHRASE not in str(result["text"])
    with Session(clean) as db:
        saved = db.get(BrokerSession, pending)
        assert saved is not None and saved.access_token_encrypted is not None
        assert settings.broker_token_key is not None
        cipher = TokenCipher(settings.broker_token_key.get_secret_value())
        assert cipher.decrypt(saved.access_token_encrypted) == ACCESS_TOKEN
        assert saved.logged_in_at == datetime(2026, 9, 24, 3, 45, tzinfo=UTC)
        assert saved.expires_at == datetime(2026, 9, 25, 0, 30, tzinfo=UTC)
    assert summaries(clean) == ["Kite login for Primary"]
    assert pending_login.get(redis_client, pending) is None
    assert kite.requests[-1].url.path == "/session/token"


def test_a_wrong_passphrase_can_be_retried(client: TestClient, pending: str) -> None:
    wrong = finish(client, pending, "not the passphrase")

    assert (wrong["status"], _message(wrong)) == (400, "Wrong passphrase")
    assert finish(client, pending)["status"] == 200


def test_five_wrong_passphrases_drop_the_login(
    client: TestClient, pending: str, clean: Engine, redis_client: Redis
) -> None:
    for _ in range(4):
        assert _message(finish(client, pending, "not the passphrase")) == "Wrong passphrase"

    fifth = finish(client, pending, "not the passphrase")

    assert _message(fifth) == "Wrong passphrase too many times: log in to Kite again"
    assert pending_login.get(redis_client, pending) is None
    assert summaries(clean) == ["Kite login failed for Primary: wrong passphrase"]
    assert _message(finish(client, pending)) == "Login expired: log in to Kite again"


def test_without_a_pending_login_it_has_expired(client: TestClient, account_id: str) -> None:
    result = finish(client, account_id)

    assert (result["status"], _message(result)) == (400, "Login expired: log in to Kite again")


def test_the_token_is_used_once(client: TestClient, pending: str) -> None:
    assert finish(client, pending)["status"] == 200

    assert _message(finish(client, pending)) == "Login expired: log in to Kite again"


def test_login_as_another_kite_user_is_refused(
    client: TestClient, pending: str, clean: Engine, kite: FakeKite
) -> None:
    kite.user_id = "ZZ9999"

    result = finish(client, pending)

    assert result["status"] == 400
    with Session(clean) as db:
        assert db.get(BrokerSession, pending) is None
    assert "expected AB1234" in summaries(clean)[0]


def test_kite_error_is_a_failed_login(
    client: TestClient, pending: str, clean: Engine, kite: FakeKite
) -> None:
    kite.error = "Token is invalid or has expired"

    result = finish(client, pending)

    assert _message(result) == "Kite login failed: Token is invalid or has expired"
    assert summaries(clean) == ["Kite login failed for Primary: Token is invalid or has expired"]


def test_unknown_account_is_not_found(client: TestClient, clean: Engine) -> None:
    assert finish(client, "brk_nope")["status"] == 404
