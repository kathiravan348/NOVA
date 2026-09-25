"""Broker contracts: mirror `frontend/packages/contracts/src/broker.ts` (D28)."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Id, IsoDate, UtcDateTime

Broker = Literal["zerodha"]
BrokerSessionStatus = Literal["active", "expired", "not_logged_in"]
BrokerLinkKind = Literal[
    "docs", "rate_limits", "console", "forum", "charges", "client_library", "other"
]

_IPV4 = r"^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$"
_URL = r"^https?://[^\s]+$"
NonEmpty = Annotated[str, Field(min_length=1)]


class BrokerSession(Contract):
    status: BrokerSessionStatus
    logged_in_at: UtcDateTime | None
    expires_at: UtcDateTime | None

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        both_null = self.logged_in_at is None and self.expires_at is None
        both_set = self.logged_in_at is not None and self.expires_at is not None
        if (self.status == "not_logged_in" and not both_null) or (
            self.status != "not_logged_in" and not both_set
        ):
            raise ValueError("not_logged_in needs null times; other statuses need both times")
        if self.logged_in_at and self.expires_at and self.logged_in_at >= self.expires_at:
            raise ValueError("loggedInAt must be earlier than expiresAt")
        return self


class BrokerAccount(Contract):
    id: Id
    broker: Broker
    label: NonEmpty
    client_id: NonEmpty
    enabled: bool
    session: BrokerSession
    created_at: UtcDateTime


class BrokerAccountCreate(Contract):
    """Body of `POST /broker/accounts` (D52). Stored with a trimmed label, upper-case client id."""

    label: Annotated[str, Field(max_length=60, pattern=r"\S")]
    client_id: Annotated[str, Field(pattern=r"^[A-Za-z0-9]{4,12}$")]


class BrokerLink(Contract):
    label: NonEmpty
    url: Annotated[str, Field(pattern=r"^https://[^\s]+$")]
    kind: BrokerLinkKind


class BrokerProfile(Contract):
    broker: Broker
    name: NonEmpty
    api: NonEmpty
    plan: NonEmpty
    subscription_renews_on: IsoDate | None
    api_key_last4: Annotated[str, Field(pattern=r"^[A-Za-z0-9]{4}$")]
    redirect_url: Annotated[str, Field(pattern=_URL)]
    postback_url: Annotated[str, Field(pattern=_URL)] | None
    static_ip: Annotated[str, Field(pattern=_IPV4)] | None
    session_rule: NonEmpty
    links: list[BrokerLink]
