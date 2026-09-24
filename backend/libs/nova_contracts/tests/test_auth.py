import json

import pytest
from nova_contracts import LoginRequest
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_login_request_round_trips_and_matches_schema(parity: Parity) -> None:
    body = {"email": "admin@example.com", "password": "correct horse"}

    dumped = LoginRequest.model_validate_json(json.dumps(body)).model_dump(mode="json")

    assert dumped == body
    parity.assert_valid(dumped, "LoginRequest")


@pytest.mark.parametrize(
    "body",
    [
        {"email": "nope", "password": "x"},
        {"email": "a@b.co", "password": ""},
        {"email": "a@b.co", "password": "x" * 201},
        {"email": "a@b.co", "password": "x", "remember": True},
    ],
)
def test_bad_login_request_is_rejected(body: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        LoginRequest.model_validate_json(json.dumps(body))
