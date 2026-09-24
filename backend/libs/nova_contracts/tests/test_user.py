import json

import pytest
from nova_contracts import User
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_mock_round_trips_and_matches_schema(parity: Parity) -> None:
    user = User.model_validate_json(parity.mock_text("user"))
    dumped = user.model_dump(mode="json")

    assert dumped == parity.mock("user")
    assert dumped["createdAt"].endswith("Z")
    parity.assert_valid(dumped, "User")


def test_extra_field_is_rejected(parity: Parity) -> None:
    data = parity.mock("user") | {"password": "x"}

    with pytest.raises(ValidationError):
        User.model_validate_json(json.dumps(data))


@pytest.mark.parametrize("stamp", ["2026-01-15T04:30:00", "2026-01-15T10:00:00+05:30"])
def test_non_utc_timestamp_is_rejected(parity: Parity, stamp: str) -> None:
    data = parity.mock("user") | {"createdAt": stamp}

    with pytest.raises(ValidationError):
        User.model_validate_json(json.dumps(data))


def test_numbers_are_not_coerced_to_strings(parity: Parity) -> None:
    data = parity.mock("user") | {"id": 1}

    with pytest.raises(ValidationError):
        User.model_validate_json(json.dumps(data))


def test_dates_parse_from_strings_in_python_mode_but_only_as_yyyy_mm_dd() -> None:
    from nova_contracts import BacktestRunCreate

    body = {
        "strategy_id": "stg_1",
        "strategy_version": 1,
        "name": "x",
        "universe": {"type": "index", "index": "NIFTY 50"},
        "from": "2025-01-01",
        "to": "2025-02-01",
        "initial_capital_paise": 1,
        "benchmark": None,
    }
    assert BacktestRunCreate.model_validate(body).from_.isoformat() == "2025-01-01"
    with pytest.raises(ValidationError):
        BacktestRunCreate.model_validate(body | {"to": "2025-2-1"})
