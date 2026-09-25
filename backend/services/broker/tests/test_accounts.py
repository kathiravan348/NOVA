from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from nova_broker.accounts import add_account
from nova_db.models import AuditEntry, BrokerSession, RateLimitRule
from nova_testing.parity import Parity
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

NOW = datetime.now(UTC)


def _seed(engine: Engine) -> dict[str, str]:
    """Three accounts: active, expired, never logged in."""
    with Session(engine) as db:
        ids = {
            label: add_account(db, label=label, client_id=client).id
            for label, client in (("Active", "AA1111"), ("Expired", "BB2222"), ("New", "CC3333"))
        }
        db.flush()
        db.add_all(
            [
                BrokerSession(
                    account_id=ids["Active"],
                    access_token_encrypted=b"sealed",
                    logged_in_at=NOW - timedelta(hours=2),
                    expires_at=NOW + timedelta(hours=10),
                ),
                BrokerSession(
                    account_id=ids["Expired"],
                    access_token_encrypted=b"sealed",
                    logged_in_at=NOW - timedelta(hours=30),
                    expires_at=NOW - timedelta(hours=6),
                ),
            ]
        )
        db.commit()
        return ids


def test_needs_the_internal_token(client: TestClient) -> None:
    response = client.get("/api/v1/broker/accounts", headers={"x-nova-internal-token": "wrong"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_accounts_show_derived_session_status(
    client: TestClient, clean: Engine, parity: Parity
) -> None:
    ids = _seed(clean)

    body = client.get("/api/v1/broker/accounts").json()

    for account in body:
        parity.assert_valid(account, "BrokerAccount")
    status = {a["label"]: a["session"]["status"] for a in body}
    assert status == {"Active": "active", "Expired": "expired", "New": "not_logged_in"}
    new = next(a for a in body if a["id"] == ids["New"])
    assert new["session"] == {"status": "not_logged_in", "loggedInAt": None, "expiresAt": None}


def test_expiry_is_audited_once(client: TestClient, clean: Engine) -> None:
    ids = _seed(clean)

    client.get("/api/v1/broker/accounts")
    client.get(f"/api/v1/broker/accounts/{ids['Expired']}")

    with Session(clean) as db:
        rows = db.scalars(
            select(AuditEntry).where(AuditEntry.action == "broker.session_expired")
        ).all()
    assert [(r.target_id, r.actor_name) for r in rows] == [(ids["Expired"], "System")]


def test_unknown_account_is_not_found(client: TestClient) -> None:
    response = client.get("/api/v1/broker/accounts/brk_nope")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_create_adds_an_account_with_default_limits(
    client: TestClient, clean: Engine, parity: Parity
) -> None:
    response = client.post(
        "/api/v1/broker/accounts", json={"label": " Main ", "clientId": "ab1234"}
    )

    assert response.status_code == 201
    body = response.json()
    parity.assert_valid(body, "BrokerAccount")
    assert (body["label"], body["clientId"], body["enabled"]) == ("Main", "AB1234", True)
    assert body["session"]["status"] == "not_logged_in"
    with Session(clean) as db:
        rules = db.scalars(select(RateLimitRule).where(RateLimitRule.account_id == body["id"]))
        assert len(rules.all()) == 6
        audit = db.scalars(
            select(AuditEntry).where(AuditEntry.action == "broker.account_create")
        ).one()
    assert (audit.actor_id, audit.target_id) == ("usr_owner", body["id"])
    assert audit.summary == "Added Main (AB1234)"


def test_create_rejects_a_duplicate_client_id(client: TestClient, clean: Engine) -> None:
    _seed(clean)

    response = client.post("/api/v1/broker/accounts", json={"label": "Again", "clientId": "aa1111"})

    assert response.status_code == 400
    assert response.json()["error"] == {
        "code": "invalid_request",
        "message": "Account AA1111 already exists",
    }


@pytest.mark.parametrize(
    "body",
    [
        {"label": "Main", "clientId": "AB-12"},
        {"label": "Main", "clientId": "ABC"},
        {"label": "   ", "clientId": "AB1234"},
        {"label": "x" * 61, "clientId": "AB1234"},
        {"label": "Main"},
        {"label": "Main", "clientId": "AB1234", "enabled": False},
    ],
)
def test_create_rejects_a_bad_body(client: TestClient, body: dict[str, object]) -> None:
    response = client.post("/api/v1/broker/accounts", json=body)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_create_needs_the_internal_token(client: TestClient) -> None:
    response = client.post(
        "/api/v1/broker/accounts",
        json={"label": "Main", "clientId": "AB1234"},
        headers={"x-nova-internal-token": "wrong"},
    )

    assert response.status_code == 401
