import json

import pytest
from nova_contracts import (
    BrokerAccount,
    BrokerAccountCreate,
    BrokerProfile,
    KiteApp,
    KiteAppUpdate,
    KiteKeysUpdate,
    KitePassphrase,
)
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_every_mock_account_round_trips_and_matches_schema(parity: Parity) -> None:
    for raw in parity.mock("brokerAccounts"):
        dumped = BrokerAccount.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, "BrokerAccount")


def test_every_mock_profile_round_trips_and_matches_schema(parity: Parity) -> None:
    for raw in parity.mock("brokerProfiles"):
        dumped = BrokerProfile.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, "BrokerProfile")


@pytest.mark.parametrize(
    "session",
    [
        {"status": "not_logged_in", "loggedInAt": "2026-09-21T03:00:00Z", "expiresAt": None},
        {"status": "active", "loggedInAt": None, "expiresAt": None},
        {
            "status": "active",
            "loggedInAt": "2026-09-22T03:00:00Z",
            "expiresAt": "2026-09-22T00:30:00Z",
        },
    ],
)
def test_inconsistent_session_is_rejected(parity: Parity, session: dict[str, object]) -> None:
    raw = parity.mock("brokerAccounts")[0] | {"session": session}

    with pytest.raises(ValidationError):
        BrokerAccount.model_validate_json(json.dumps(raw))


@pytest.mark.parametrize(
    "change",
    [
        {"apiKeyLast4": "k7Q2"},
        {"plan": "Paid"},
        {"links": [{"label": "Docs", "url": "http://kite.trade", "kind": "docs"}]},
    ],
)
def test_bad_profile_is_rejected(parity: Parity, change: dict[str, object]) -> None:
    raw = parity.mock("brokerProfiles")[0] | change

    with pytest.raises(ValidationError):
        BrokerProfile.model_validate_json(json.dumps(raw))


def test_create_body_matches_schema(parity: Parity) -> None:
    body = {"label": "Main", "clientId": "AB1234"}

    dumped = BrokerAccountCreate.model_validate_json(json.dumps(body)).model_dump(mode="json")

    assert dumped == body
    parity.assert_valid(dumped, "BrokerAccountCreate")


@pytest.mark.parametrize(
    "body",
    [
        {"label": " ", "clientId": "AB1234"},
        {"label": "x" * 61, "clientId": "AB1234"},
        {"label": "Main", "clientId": "AB 12"},
        {"label": "Main", "clientId": "ABCDEFGHIJKLM"},
    ],
)
def test_bad_create_body_is_rejected(body: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        BrokerAccountCreate.model_validate_json(json.dumps(body))


def test_every_mock_kite_app_round_trips_and_matches_schema(parity: Parity) -> None:
    for raw in parity.mock("kiteApps"):
        dumped = KiteApp.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, "KiteApp")


@pytest.mark.parametrize(
    "change",
    [
        {"secretSaved": False},
        {"apiKeyLast4": "abcd1"},
        {"staticIp": "300.1.1.1"},
        {"plan": " "},
        {"apiSecret": "s"},
    ],
)
def test_bad_kite_app_is_rejected(parity: Parity, change: dict[str, object]) -> None:
    raw = parity.mock("kiteApps")[0] | change

    with pytest.raises(ValidationError):
        KiteApp.model_validate_json(json.dumps(raw))


def test_kite_bodies_match_their_schemas(parity: Parity) -> None:
    keys = {"apiKey": "kitekeyAB12", "apiSecret": "kite-secret", "passphrase": "x" * 12}
    details = {
        "plan": "Paid",
        "subscriptionRenewsOn": "2026-10-15",
        "postbackUrl": "https://example.com/postback",
        "staticIp": "203.0.113.5",
    }

    parity.assert_valid(
        KiteKeysUpdate.model_validate(keys).model_dump(mode="json"), "KiteKeysUpdate"
    )
    parity.assert_valid(
        KiteAppUpdate.model_validate_json(json.dumps(details)).model_dump(mode="json"),
        "KiteAppUpdate",
    )
    parity.assert_valid(
        KitePassphrase.model_validate({"passphrase": "p"}).model_dump(mode="json"), "KitePassphrase"
    )


@pytest.mark.parametrize(
    "change",
    [{"apiKey": "key-1"}, {"apiSecret": "a b"}, {"apiSecret": ""}, {"passphrase": "x" * 11}],
)
def test_bad_keys_body_is_rejected(change: dict[str, object]) -> None:
    keys = {"apiKey": "kitekeyAB12", "apiSecret": "kite-secret", "passphrase": "x" * 12}

    with pytest.raises(ValidationError):
        KiteKeysUpdate.model_validate(keys | change)
