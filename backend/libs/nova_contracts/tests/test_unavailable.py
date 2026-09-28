"""Unavailable-date mock and wire parity."""

import json

import pytest
from nova_contracts import UnavailableDay
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_unavailable_history_matches_mock_and_wire_schema(parity: Parity) -> None:
    for raw in parity.mock("unavailable"):
        dumped = UnavailableDay.model_validate_json(json.dumps(raw)).model_dump(mode="json")
        assert dumped == raw
        parity.assert_valid(dumped, "UnavailableDay")


def test_resolved_record_requires_timestamp(parity: Parity) -> None:
    raw = parity.mock("unavailable")[0] | {"status": "resolved"}
    with pytest.raises(ValidationError):
        UnavailableDay.model_validate_json(json.dumps(raw))
