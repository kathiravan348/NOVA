import json

import pytest
from nova_contracts import DataJob, DataJobCreate
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_every_mock_job_round_trips_and_matches_schema(parity: Parity) -> None:
    for raw in parity.mock("dataJobs"):
        dumped = DataJob.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, "DataJob")


@pytest.mark.parametrize(
    "change",
    [
        {"timeframe": None},
        {"from": "2026-07-01", "to": "2026-01-01"},
        {"to": None},
        {"error": "boom"},
        {"progressPercent": 50},
        {"status": "queued"},
    ],
)
def test_broken_rules_are_rejected(parity: Parity, change: dict[str, object]) -> None:
    raw = parity.mock("dataJobs")[0] | change  # a completed historical download

    with pytest.raises(ValidationError):
        DataJob.model_validate_json(json.dumps(raw))


def test_create_body_matches_schema_and_defaults_segment(parity: Parity) -> None:
    body = {"symbols": ["INFY"], "timeframe": "1d", "from": "2025-01-01", "to": "2025-12-31"}

    dumped = DataJobCreate.model_validate_json(json.dumps(body)).model_dump(mode="json")

    assert dumped == body | {"segment": "equity_delivery"}
    parity.assert_valid(dumped, "DataJobCreate")


@pytest.mark.parametrize(
    "change",
    [
        {"symbols": []},
        {"symbols": [f"S{i}" for i in range(201)]},
        {"from": "2026-01-01", "to": "2025-01-01"},
        {"timeframe": "2d"},
        {"extra": True},
    ],
)
def test_bad_create_body_is_rejected(change: dict[str, object]) -> None:
    body = {"symbols": ["INFY"], "timeframe": "1d", "from": "2025-01-01", "to": "2025-12-31"}

    with pytest.raises(ValidationError):
        DataJobCreate.model_validate_json(json.dumps(body | change))
