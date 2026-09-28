"""Agent accounts and held requests (D67)."""

from typing import Annotated, Literal

from pydantic import Field, JsonValue

from nova_contracts.common import Contract, Email, Id, UtcDateTime

ApprovalStatus = Literal["pending", "done", "failed", "rejected", "expired"]


class ApprovalRequest(Contract):
    id: Id
    method: Literal["POST", "PUT", "PATCH", "DELETE"]
    path: Annotated[str, Field(pattern=r"^/")]
    query: str
    body: JsonValue
    status: ApprovalStatus
    agent_name: Annotated[str, Field(min_length=1)]
    created_at: UtcDateTime
    decided_at: UtcDateTime | None
    decided_by: Annotated[str, Field(min_length=1)] | None
    result_status: int | None
    result_body: Annotated[str, Field(max_length=8000)] | None


class AgentAccount(Contract):
    id: Id
    name: Annotated[str, Field(min_length=1)]
    email: Email
    enabled: bool
    created_at: UtcDateTime
    last_login_at: UtcDateTime | None


class AgentAccountCreate(Contract):
    name: Annotated[str, Field(min_length=1)]
    email: Email
    password: Annotated[str, Field(min_length=12)]


class AgentPasswordUpdate(Contract):
    password: Annotated[str, Field(min_length=12)]


class AgentAccessUpdate(Contract):
    enabled: bool
