import json
from typing import Any

import pytest
from nova_contracts import CoverageDetail, CoverageList, CoverageRow
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_mock_lists_and_details_round_trip_and_match_their_schemas(parity: Parity) -> None:
    mock = parity.mock("coverage")
    for raw in mock["lists"]:
        dumped = CoverageList.model_validate_json(json.dumps(raw)).model_dump(
            mode="json", by_alias=True
        )
        assert dumped == raw
        parity.assert_valid(dumped, "CoverageList")
    for raw in mock["details"]:
        dumped = CoverageDetail.model_validate_json(json.dumps(raw)).model_dump(
            mode="json", by_alias=True
        )
        assert dumped == raw
        parity.assert_valid(dumped, "CoverageDetail")


@pytest.mark.parametrize(
    "change",
    [
        {"status": "none"},
        {"days": 0},
        {"missingDays": 3},
        {"firstDay": None},
        {"status": "unknown"},
    ],
)
def test_rows_whose_status_disagrees_are_refused(parity: Parity, change: dict[str, Any]) -> None:
    row = next(r for r in parity.mock("coverage")["lists"][0]["rows"] if r["status"] == "complete")

    with pytest.raises(ValidationError):
        CoverageRow.model_validate_json(json.dumps(row | change))


def test_missing_ranges_must_add_up(parity: Parity) -> None:
    detail = parity.mock("coverage")["details"][0] | {"missingDays": 99}

    with pytest.raises(ValidationError):
        CoverageDetail.model_validate_json(json.dumps(detail))
