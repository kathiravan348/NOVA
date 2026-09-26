from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from nova_broker.vault import unseal
from nova_db.models import AuditEntry, BrokerKiteApp, BrokerSession
from nova_testing.parity import Parity
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

PASSPHRASE = "correct horse battery"
KEYS = {"apiKey": "kitekeyAB12", "apiSecret": "kite-secret", "passphrase": PASSPHRASE}
DETAILS = {
    "plan": " Kite Connect (paid) ",
    "subscriptionRenewsOn": "2026-10-15",
    "postbackUrl": "https://example.com/postback",
    "staticIp": "203.0.113.5",
}


def _url(account_id: str, path: str = "") -> str:
    return f"/api/v1/broker/accounts/{account_id}/kite-app{path}"


def _audits(engine: Engine) -> list[str]:
    with Session(engine) as db:
        rows = db.scalars(
            select(AuditEntry)
            .where(AuditEntry.action == "broker.kite_app_update")
            .order_by(AuditEntry.at)
        ).all()
        return [row.summary for row in rows]


def test_an_account_without_an_app_row_has_empty_values(
    client: TestClient, account_id: str, parity: Parity
) -> None:
    body = client.get(_url(account_id)).json()

    parity.assert_valid(body, "KiteApp")
    assert body == {
        "accountId": account_id,
        "apiKeyLast4": None,
        "secretSaved": False,
        "plan": None,
        "subscriptionRenewsOn": None,
        "redirectUrl": "http://relay.test/api/v1/broker/kite/callback",
        "postbackUrl": None,
        "staticIp": None,
        "updatedAt": None,
    }


def test_saving_keys_seals_the_secret_and_never_returns_it(
    client: TestClient, account_id: str, clean: Engine, parity: Parity
) -> None:
    response = client.put(_url(account_id, "/keys"), json=KEYS)

    assert response.status_code == 200
    body = response.json()
    parity.assert_valid(body, "KiteApp")
    assert (body["apiKeyLast4"], body["secretSaved"]) == ("AB12", True)
    assert "kite-secret" not in response.text and PASSPHRASE not in response.text
    with Session(clean) as db:
        row = db.get(BrokerKiteApp, account_id)
        assert row is not None and row.api_secret_sealed is not None
        assert row.api_key == "kitekeyAB12"
        assert b"kite-secret" not in row.api_secret_sealed
        assert unseal(row.api_secret_sealed, PASSPHRASE, account_id) == "kite-secret"
    assert _audits(clean) == ["Saved Kite API key …AB12 and secret for Primary"]
    assert PASSPHRASE not in str(_audits(clean))


def _add_session(engine: Engine, account_id: str) -> None:
    now = datetime.now(UTC)
    with Session(engine) as db:
        db.add(
            BrokerSession(
                account_id=account_id,
                access_token_encrypted=b"sealed",
                logged_in_at=now,
                expires_at=now + timedelta(hours=8),
            )
        )
        db.commit()


def test_a_new_key_ends_the_session_but_the_same_key_does_not(
    client: TestClient, account_id: str, clean: Engine
) -> None:
    client.put(_url(account_id, "/keys"), json=KEYS)
    _add_session(clean, account_id)

    client.put(_url(account_id, "/keys"), json=KEYS | {"passphrase": "another passphrase"})
    with Session(clean) as db:
        assert db.get(BrokerSession, account_id) is not None

    client.put(_url(account_id, "/keys"), json=KEYS | {"apiKey": "newkeyCD34"})
    with Session(clean) as db:
        assert db.get(BrokerSession, account_id) is None


def test_details_are_saved_without_touching_the_keys(
    client: TestClient, account_id: str, clean: Engine, parity: Parity
) -> None:
    client.put(_url(account_id, "/keys"), json=KEYS)

    body = client.patch(_url(account_id), json=DETAILS).json()

    parity.assert_valid(body, "KiteApp")
    assert body["plan"] == "Kite Connect (paid)"
    assert body["staticIp"] == "203.0.113.5"
    assert (body["apiKeyLast4"], body["secretSaved"]) == ("AB12", True)
    assert body["updatedAt"] is not None
    assert _audits(clean)[-1] == "Updated Kite app details for Primary"


def test_details_can_be_saved_before_the_keys(client: TestClient, account_id: str) -> None:
    body = client.patch(_url(account_id), json=DETAILS | {"plan": None}).json()

    assert (body["plan"], body["apiKeyLast4"], body["secretSaved"]) == (None, None, False)


def test_passphrase_check(client: TestClient, account_id: str) -> None:
    no_keys = client.post(_url(account_id, "/check"), json={"passphrase": PASSPHRASE})
    assert no_keys.status_code == 400
    assert no_keys.json()["error"]["message"] == "Save the Kite API key and secret first"

    client.put(_url(account_id, "/keys"), json=KEYS)

    assert (
        client.post(_url(account_id, "/check"), json={"passphrase": PASSPHRASE}).status_code == 204
    )
    wrong = client.post(_url(account_id, "/check"), json={"passphrase": "not the passphrase"})
    assert wrong.status_code == 400
    assert wrong.json()["error"]["message"] == "Wrong passphrase"


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("get", "", None),
        ("put", "/keys", KEYS),
        ("patch", "", DETAILS),
        ("post", "/check", {"passphrase": PASSPHRASE}),
    ],
)
def test_unknown_account_is_not_found(
    client: TestClient, clean: Engine, method: str, path: str, body: object
) -> None:
    response = client.request(method, _url("brk_nope", path), json=body)

    assert response.status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        KEYS | {"passphrase": "short"},
        KEYS | {"apiKey": "bad key"},
        KEYS | {"apiSecret": ""},
        {"apiKey": "kitekeyAB12", "apiSecret": "kite-secret"},
    ],
)
def test_bad_keys_body_is_rejected(client: TestClient, account_id: str, body: object) -> None:
    assert client.put(_url(account_id, "/keys"), json=body).status_code == 400


def test_needs_the_internal_token(client: TestClient, account_id: str) -> None:
    response = client.get(_url(account_id), headers={"x-nova-internal-token": "wrong"})

    assert response.status_code == 401
