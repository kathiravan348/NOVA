import json

import pytest
from nova_contracts import DataJob, DataJobCreate, DataJobPlanRequest, DownloadSettings
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
        {"symbols": []},
        {"summary": "x" * 501},
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


def test_an_instrument_sync_job_has_no_symbols(parity: Parity) -> None:
    raw = parity.mock("dataJobs")[0] | {
        "type": "instrument_sync",
        "symbols": [],
        "timeframe": None,
        "from": None,
        "to": None,
        "summary": "2,431 stocks, 3 new listings",
    }

    dumped = DataJob.model_validate_json(json.dumps(raw)).model_dump(mode="json")

    parity.assert_valid(dumped, "DataJob")


def _draft(parity: Parity) -> dict[str, object]:
    job: dict[str, object] = parity.mock("dataJobs")[0]
    return job | {
        "status": "draft",
        "progressPercent": 0,
        "rowsWritten": 0,
        "startedAt": None,
        "finishedAt": None,
        "mode": "skip_existing",
        "plan": {
            "steps": 2,
            "skippedSteps": 1,
            "requests": 1,
            "estimatedRows": 375,
            "estimatedBytes": 30000,
            "estimatedSeconds": 1,
            "estimatedStartAt": "2026-09-26T06:00:00Z",
            "jobsAhead": 0,
            "perSymbol": [
                {
                    "symbol": "INFY",
                    "steps": 2,
                    "skippedSteps": 1,
                    "existingFrom": "2025-01-01",
                    "existingTo": None,
                }
            ],
            "warnings": [],
        },
        "stepsTotal": 2,
        "expiresAt": "2026-09-27T06:00:00Z",
    }


def test_a_draft_with_a_plan_round_trips_and_matches_schema(parity: Parity) -> None:
    raw = _draft(parity)

    dumped = DataJob.model_validate_json(json.dumps(raw)).model_dump(mode="json")

    assert dumped == raw
    parity.assert_valid(dumped, "DataJob")
    parity.assert_valid(dumped["plan"], "DataJobPlan")


@pytest.mark.parametrize("change", [{"plan": None}, {"expiresAt": None}, {"status": "stopped"}])
def test_broken_drafts_are_rejected(parity: Parity, change: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        DataJob.model_validate_json(json.dumps(_draft(parity) | change))


def test_plan_request_and_settings_match_schema(parity: Parity) -> None:
    body = {"symbols": ["INFY"], "timeframe": "1m", "from": "2025-01-01", "to": "2025-12-31"}

    request = DataJobPlanRequest.model_validate_json(json.dumps(body)).model_dump(mode="json")
    settings = DownloadSettings(market_hours_mode="full").model_dump(mode="json")

    assert request["mode"] == "skip_existing"
    parity.assert_valid(request, "DataJobPlanRequest")
    assert settings == {"marketHoursMode": "full"}
    parity.assert_valid(settings, "DownloadSettings")
