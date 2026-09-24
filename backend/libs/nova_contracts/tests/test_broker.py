import json

import pytest
from nova_contracts import BrokerAccount, BrokerProfile
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
        {"apiKeyLast4": "abcd1"},
        {"staticIp": "300.1.1.1"},
        {"links": [{"label": "Docs", "url": "http://kite.trade", "kind": "docs"}]},
    ],
)
def test_bad_profile_is_rejected(parity: Parity, change: dict[str, object]) -> None:
    raw = parity.mock("brokerProfiles")[0] | change

    with pytest.raises(ValidationError):
        BrokerProfile.model_validate_json(json.dumps(raw))
