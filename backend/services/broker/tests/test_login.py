"""The daily Kite login: redirect out, callback in, token saved encrypted (D39)."""

from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from nova_broker.crypto import TokenCipher
from nova_broker.settings import BrokerSettings
from nova_db.models import AuditEntry, BrokerAccount, BrokerSession
from nova_testing.kite import FakeKite
from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session

CALLBACK = "/api/v1/broker/kite/callback"


def _start(client: TestClient, account_id: str) -> str:
    """Starts a login and returns the signed state Kite would send back."""
    response = client.get(f"/api/v1/broker/accounts/{account_id}/login")
    assert response.status_code == 302
    query = parse_qs(urlparse(response.headers["location"]).query)
    return parse_qs(query["redirect_params"][0])["state"][0]


def _summaries(engine: Engine) -> list[str]:
    with Session(engine) as db:
        rows = db.scalars(select(AuditEntry).where(AuditEntry.action == "broker.login"))
        return [row.summary for row in rows]


def test_login_redirects_to_kite(client: TestClient, account_id: str) -> None:
    response = client.get(f"/api/v1/broker/accounts/{account_id}/login")

    location = urlparse(response.headers["location"])
    assert response.status_code == 302
    assert location.netloc == "kite.zerodha.com"
    assert parse_qs(location.query)["api_key"] == ["kitekeyAB12"]


def test_disabled_account_cannot_log_in(client: TestClient, account_id: str, clean: Engine) -> None:
    with Session(clean) as db:
        db.execute(update(BrokerAccount).values(enabled=False))
        db.commit()

    assert client.get(f"/api/v1/broker/accounts/{account_id}/login").status_code == 400


def test_callback_saves_the_encrypted_token_until_0600_ist(
    client: TestClient, account_id: str, clean: Engine, settings: BrokerSettings
) -> None:
    state = _start(client, account_id)

    response = client.get(
        CALLBACK, params={"state": state, "status": "success", "request_token": "req-1"}
    )

    assert response.status_code == 302
    assert response.headers["location"] == f"http://relay.test/accounts/{account_id}?kite=connected"
    with Session(clean) as db:
        saved = db.get(BrokerSession, account_id)
        assert saved is not None and saved.access_token_encrypted is not None
        assert b"kite-access-token-secret" not in saved.access_token_encrypted
        assert settings.broker_token_key is not None
        cipher = TokenCipher(settings.broker_token_key.get_secret_value())
        assert cipher.decrypt(saved.access_token_encrypted) == "kite-access-token-secret"
        assert saved.logged_in_at == datetime(2026, 9, 24, 3, 45, tzinfo=UTC)
        assert saved.expires_at == datetime(2026, 9, 25, 0, 30, tzinfo=UTC)
    assert _summaries(clean) == ["Kite login for Primary"]


def test_forged_state_goes_back_to_the_account_list(client: TestClient, account_id: str) -> None:
    response = client.get(
        CALLBACK,
        params={
            "state": f"{account_id}.9999999999.forged",
            "status": "success",
            "request_token": "r",
        },
    )

    assert response.headers["location"] == "http://relay.test/accounts?kite=failed"


def test_cancelled_login_is_audited_and_saves_nothing(
    client: TestClient, account_id: str, clean: Engine
) -> None:
    state = _start(client, account_id)

    response = client.get(CALLBACK, params={"state": state, "status": "cancelled"})

    assert response.headers["location"].endswith(f"/accounts/{account_id}?kite=failed")
    with Session(clean) as db:
        assert db.get(BrokerSession, account_id) is None
    assert _summaries(clean) == ["Kite login failed for Primary: login was cancelled or refused"]


def test_login_as_another_kite_user_is_refused(
    client: TestClient, account_id: str, clean: Engine, kite: FakeKite
) -> None:
    kite.user_id = "ZZ9999"
    state = _start(client, account_id)

    response = client.get(
        CALLBACK, params={"state": state, "status": "success", "request_token": "req-1"}
    )

    assert response.headers["location"].endswith("?kite=failed")
    with Session(clean) as db:
        assert db.get(BrokerSession, account_id) is None
    assert "expected AB1234" in _summaries(clean)[0]


def test_kite_error_is_a_failed_login(client: TestClient, account_id: str, kite: FakeKite) -> None:
    kite.error = "Token is invalid or has expired"
    state = _start(client, account_id)

    response = client.get(
        CALLBACK, params={"state": state, "status": "success", "request_token": "req-1"}
    )

    assert response.headers["location"].endswith("?kite=failed")
