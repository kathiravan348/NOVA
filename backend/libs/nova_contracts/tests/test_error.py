import json

import pytest
from nova_contracts import ApiError
from nova_testing.parity import Parity
from pydantic import ValidationError

EXAMPLES = [
    {"error": {"code": "not_found", "message": "Strategy strat-999 not found"}},
    {"error": {"code": "invalid_request", "message": "limit: must be 1-200"}},
    {"error": {"code": "internal", "message": "Internal error"}},
]


@pytest.mark.parametrize("example", EXAMPLES)
def test_examples_round_trip_and_match_schema(parity: Parity, example: dict[str, object]) -> None:
    dumped = ApiError.model_validate_json(json.dumps(example)).model_dump(mode="json")

    assert dumped == example
    parity.assert_valid(dumped, "ApiError")


@pytest.mark.parametrize(
    "bad",
    [
        {"error": {"code": "bad_request", "message": "x"}},
        {"error": {"code": "internal", "message": ""}},
        {"error": {"code": "internal", "message": "x", "stack": "..."}},
    ],
)
def test_invalid_errors_are_rejected(bad: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        ApiError.model_validate_json(json.dumps(bad))
