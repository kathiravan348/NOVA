"""Rate limits (D27): mirror `frontend/packages/contracts/src/rateLimit.ts`."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Id, UtcDateTime

RateLimitEndpoint = Literal["quote", "historical", "orders", "other"]
RateLimitWindow = Literal["second", "minute", "day"]
Positive = Annotated[int, Field(gt=0)]


class RateLimitRule(Contract):
    window: RateLimitWindow
    broker_limit: Positive
    nova_limit: Positive
    used: Annotated[int, Field(ge=0)]
    resets_at: UtcDateTime | None

    @model_validator(mode="after")
    def _limits(self) -> Self:
        if self.nova_limit > self.broker_limit:
            raise ValueError("novaLimit must be less than or equal to brokerLimit")
        if self.used > self.broker_limit:
            raise ValueError("used must be less than or equal to brokerLimit")
        if (self.window == "day") != (self.resets_at is not None):
            raise ValueError("resetsAt is set only for the day window")
        return self


class RateLimit(Contract):
    account_id: Id
    endpoint: RateLimitEndpoint
    rules: Annotated[list[RateLimitRule], Field(min_length=1)]
    throttled_today: Annotated[int, Field(ge=0)]
    updated_at: UtcDateTime

    @model_validator(mode="after")
    def _unique_windows(self) -> Self:
        if len({rule.window for rule in self.rules}) != len(self.rules):
            raise ValueError("rules must have unique windows")
        return self


class RateLimitUpdate(Contract):
    """Body of `PATCH /broker/rate-limits/{accountId}/{endpoint}`: changes one NOVA limit."""

    window: RateLimitWindow
    nova_limit: Positive
