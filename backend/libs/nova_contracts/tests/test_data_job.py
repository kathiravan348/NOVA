import json

import pytest
from nova_contracts import DataJob
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
