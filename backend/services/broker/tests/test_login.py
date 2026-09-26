"""The daily Kite login, first half: redirect out with the account's key, callback in (D39, D55)."""

from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from nova_broker import pending_login
from nova_db.models import AuditEntry, BrokerAccount, BrokerKiteApp, BrokerSession
from redis import Redis
from sqlalchemy import Engine, delete, select, update
from sqlalchemy.orm import Session

CALLBACK = "/api/v1/broker/kite/callback"


def start(client: TestClient, account_id: str) -> str:
    """Starts a login and returns the signed state Kite would send back."""
    response = client.get(f"/api/v1/broker/accounts/{account_id}/login")
    assert response.status_code == 302
    query = parse_qs(urlparse(response.headers["location"]).query)
    return parse_qs(query["redirect_params"][0])["state"][0]


def summaries(engine: Engine) -> list[str]:
    with Session(engine) as db:
        rows = db.scalars(
            select(AuditEntry).where(AuditEntry.action == "broker.login").order_by(AuditEntry.at)
        )
        return [row.summary for row in rows]


def test_login_redirects_to_kite_with_the_accounts_own_key(
    client: TestClient, account_id: str
) -> None:
    response = client.get(f"/api/v1/broker/accounts/{account_id}/login")

    location = urlparse(response.headers["location"])
    assert response.status_code == 302
    assert location.netloc == "kite.zerodha.com"
    assert parse_qs(location.query)["api_key"] == ["kitekeyAB12"]


def test_login_needs_saved_keys(client: TestClient, account_id: str, clean: Engine) -> None:
    with Session(clean) as db:
        db.execute(delete(BrokerKiteApp))
        db.commit()

    response = client.get(f"/api/v1/broker/accounts/{account_id}/login")

    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Save the Kite API key and secret first"


def test_disabled_account_cannot_log_in(client: TestClient, account_id: str, clean: Engine) -> None:
    with Session(clean) as db:
        db.execute(update(BrokerAccount).values(enabled=False))
        db.commit()

    assert client.get(f"/api/v1/broker/accounts/{account_id}/login").status_code == 400


def test_callback_keeps_the_request_token_and_asks_for_the_passphrase(
    client: TestClient, account_id: str, clean: Engine, redis_client: Redis
) -> None:
    state = start(client, account_id)

    response = client.get(
        CALLBACK, params={"state": state, "status": "success", "request_token": "req-1"}
    )

    assert response.status_code == 302
    assert response.headers["location"] == f"http://relay.test/broker/{account_id}?kite=finish"
    assert pending_login.get(redis_client, account_id) == "req-1"
    assert 0 < int(redis_client.ttl(f"broker:pending_login:{account_id}")) <= 120
    with Session(clean) as db:
        assert db.get(BrokerSession, account_id) is None
    assert summaries(clean) == []


def test_forged_state_goes_back_to_the_broker_page(client: TestClient, account_id: str) -> None:
    response = client.get(
        CALLBACK,
        params={
            "state": f"{account_id}.9999999999.forged",
            "status": "success",
            "request_token": "r",
        },
    )

    assert response.headers["location"] == "http://relay.test/broker?kite=failed"


def test_cancelled_login_is_audited_and_keeps_nothing(
    client: TestClient, account_id: str, clean: Engine, redis_client: Redis
) -> None:
    state = start(client, account_id)

    response = client.get(CALLBACK, params={"state": state, "status": "cancelled"})

    assert response.headers["location"].endswith(f"/broker/{account_id}?kite=failed")
    assert pending_login.get(redis_client, account_id) is None
    assert summaries(clean) == ["Kite login failed for Primary: login was cancelled or refused"]
