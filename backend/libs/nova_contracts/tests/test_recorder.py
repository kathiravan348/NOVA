import json

import pytest
from nova_contracts import RecorderSettings, RecorderSettingsUpdate
from nova_testing.parity import Parity
from pydantic import ValidationError

SETTINGS = {
    "enabled": True,
    "symbols": ["INFY"],
    "state": "recording",
    "jobId": "job_1",
    "updatedAt": "2026-09-25T03:45:00Z",
}


def test_setting_and_update_match_their_schemas(parity: Parity) -> None:
    dumped = RecorderSettings.model_validate_json(json.dumps(SETTINGS)).model_dump(mode="json")
    update = RecorderSettingsUpdate.model_validate({"enabled": False, "symbols": []})

    assert dumped == SETTINGS
    parity.assert_valid(dumped, "RecorderSettings")
    parity.assert_valid(update.model_dump(mode="json"), "RecorderSettingsUpdate")


@pytest.mark.parametrize("change", [{"state": "paused"}, {"symbols": ["infy"]}, {"jobId": ""}])
def test_bad_setting_is_rejected(change: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        RecorderSettings.model_validate_json(json.dumps(SETTINGS | change))


def test_update_is_capped_at_kites_limit() -> None:
    symbols = [f"S{i}" for i in range(3001)]

    with pytest.raises(ValidationError):
        RecorderSettingsUpdate.model_validate({"enabled": True, "symbols": symbols})
