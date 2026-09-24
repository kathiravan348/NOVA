import json

import pytest
from nova_contracts import RateLimit, RateLimitUpdate
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_every_mock_limit_round_trips_and_matches_schema(parity: Parity) -> None:
    for raw in parity.mock("rateLimits"):
        dumped = RateLimit.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, "RateLimit")


def test_update_matches_schema(parity: Parity) -> None:
    body = {"window": "day", "novaLimit": 4000}

    dumped = RateLimitUpdate.model_validate_json(json.dumps(body)).model_dump(mode="json")

    assert dumped == body
    parity.assert_valid(dumped, "RateLimitUpdate")


@pytest.mark.parametrize(
    "rule",
    [
        {"window": "second", "brokerLimit": 10, "novaLimit": 11, "used": 0, "resetsAt": None},
        {"window": "second", "brokerLimit": 10, "novaLimit": 8, "used": 11, "resetsAt": None},
        {"window": "day", "brokerLimit": 10, "novaLimit": 8, "used": 0, "resetsAt": None},
        {
            "window": "minute",
            "brokerLimit": 10,
            "novaLimit": 8,
            "used": 0,
            "resetsAt": "2026-09-21T18:30:00Z",
        },
    ],
)
def test_bad_rule_is_rejected(parity: Parity, rule: dict[str, object]) -> None:
    raw = parity.mock("rateLimits")[0] | {"rules": [rule]}

    with pytest.raises(ValidationError):
        RateLimit.model_validate_json(json.dumps(raw))


def test_duplicate_windows_are_rejected(parity: Parity) -> None:
    raw = parity.mock("rateLimits")[0]
    raw = raw | {"rules": raw["rules"] * 2}

    with pytest.raises(ValidationError):
        RateLimit.model_validate_json(json.dumps(raw))
