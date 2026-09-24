"""AuditEntry: mirrors `frontend/packages/contracts/src/audit.ts`."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Id, UtcDateTime

AuditAction = Literal[
    "auth.login",
    "auth.logout",
    "broker.login",
    "broker.session_expired",
    "broker.rate_limit_update",
    "strategy.create",
    "strategy.update",
    "backtest.run",
    "data_job.create",
    "data_job.cancel",
    "settings.update",
]
AuditTargetType = Literal["user", "broker_account", "strategy", "backtest", "data_job", "settings"]


class AuditEntry(Contract):
    id: Id
    at: UtcDateTime
    actor_id: Id | None
    actor_name: Annotated[str, Field(min_length=1)]
    action: AuditAction
    target_type: AuditTargetType | None
    target_id: Id | None
    summary: Annotated[str, Field(min_length=1)]
    ip: str | None

    @model_validator(mode="after")
    def _target_pair(self) -> Self:
        if (self.target_type is None) != (self.target_id is None):
            raise ValueError("targetType and targetId must both be null or both be set")
        return self
