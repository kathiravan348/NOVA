"""Wire validation and JSON Schema parity for D67."""

import json

import pytest
from nova_contracts import (
    AgentAccessUpdate,
    AgentAccount,
    AgentAccountCreate,
    AgentPasswordUpdate,
    ApiError,
    ApprovalRequest,
    Contract,
    User,
)
from nova_testing.parity import Parity
from pydantic import ValidationError

APPROVAL: dict[str, object] = {
    "id": "approval_1",
    "method": "POST",
    "path": "/backtests",
    "query": "",
    "body": None,
    "status": "pending",
    "agentName": "Agent",
    "createdAt": "2026-09-28T04:00:00Z",
    "decidedAt": None,
    "decidedBy": None,
    "resultStatus": None,
    "resultBody": None,
}
ACCOUNT: dict[str, object] = {
    "id": "agent_1",
    "name": "Agent",
    "email": "agent@example.com",
    "enabled": True,
    "createdAt": "2026-09-28T04:00:00Z",
    "lastLoginAt": None,
}


@pytest.mark.parametrize("body", [None, False, 12.5, "text", [1, None], {"nested": [True]}])
def test_json_bodies_round_trip(parity: Parity, body: object) -> None:
    data = APPROVAL | {"body": body}
    dumped = ApprovalRequest.model_validate_json(json.dumps(data)).model_dump(mode="json")
    assert dumped == data
    parity.assert_valid(dumped, "ApprovalRequest")


@pytest.mark.parametrize("status", ["pending", "done", "failed", "rejected", "expired"])
def test_statuses_and_results(parity: Parity, status: str) -> None:
    data = APPROVAL | {
        "status": status,
        "decidedAt": "2026-09-28T04:01:00Z",
        "decidedBy": "Admin",
        "resultStatus": 201,
        "resultBody": "x" * 8000,
    }
    dumped = ApprovalRequest.model_validate(data).model_dump(mode="json")
    assert dumped == data
    parity.assert_valid(dumped, "ApprovalRequest")


@pytest.mark.parametrize(
    "change",
    [
        {"path": "backtests"},
        {"method": "GET"},
        {"status": "approved"},
        {"resultStatus": 200.5},
        {"resultStatus": True},
        {"resultBody": "x" * 8001},
        {"createdAt": "2026-09-28T09:30:00+05:30"},
        {"extra": True},
    ],
)
def test_invalid_requests(change: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        ApprovalRequest.model_validate(APPROVAL | change)


@pytest.mark.parametrize(
    ("model", "data"),
    [
        (AgentAccount, ACCOUNT),
        (AgentAccountCreate, {"name": "Agent", "email": "agent@example.com", "password": "x" * 12}),
        (AgentPasswordUpdate, {"password": "x" * 12}),
        (AgentAccessUpdate, {"enabled": False}),
    ],
)
def test_account_contract_parity(
    parity: Parity, model: type[Contract], data: dict[str, object]
) -> None:
    dumped = model.model_validate(data).model_dump(mode="json")
    assert dumped == data
    parity.assert_valid(dumped, model.__name__)


@pytest.mark.parametrize(
    ("model", "data"),
    [
        (AgentAccount, ACCOUNT | {"password": "x"}),
        (AgentAccount, ACCOUNT | {"enabled": "true"}),
        (AgentAccountCreate, {"name": "", "email": "agent@example.com", "password": "x" * 12}),
        (AgentAccountCreate, {"name": "Agent", "email": "invalid", "password": "x" * 12}),
        (AgentAccountCreate, {"name": "Agent", "email": "agent@example.com", "password": "x" * 11}),
        (AgentPasswordUpdate, {"password": "x" * 11}),
        (AgentAccessUpdate, {"enabled": 0}),
        (AgentAccessUpdate, {"enabled": True, "role": "super_admin"}),
    ],
)
def test_invalid_account_writes(model: type[Contract], data: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        model.model_validate(data)


def test_agent_role_and_forbidden(parity: Parity) -> None:
    data = parity.mock("user") | {"role": "agent"}
    dumped = User.model_validate(data).model_dump(mode="json")
    assert dumped == data
    parity.assert_valid(dumped, "User")
    error = ApiError.model_validate({"error": {"code": "forbidden", "message": "Not allowed"}})
    parity.assert_valid(error.model_dump(mode="json"), "ApiError")
