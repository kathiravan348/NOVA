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
    """Broker facts from the repo data file (D28). App details are per account: `KiteApp` (D55)."""

    broker: Broker
    name: NonEmpty
    api: NonEmpty
    session_rule: NonEmpty
    links: list[BrokerLink]


_KEY_LAST4 = Annotated[str, Field(pattern=r"^[A-Za-z0-9]{4}$")]
Plan = Annotated[str, Field(max_length=60, pattern=r"\S")]
Url = Annotated[str, Field(pattern=_URL)]
Ipv4 = Annotated[str, Field(pattern=_IPV4)]


class KiteApp(Contract):
    """One account's Kite Connect app (D55). The secret is never sent, only whether one is saved."""

    account_id: Id
    api_key_last4: _KEY_LAST4 | None
    secret_saved: bool
    plan: Plan | None
    subscription_renews_on: IsoDate | None
    redirect_url: Url
    postback_url: Url | None
    static_ip: Ipv4 | None
    updated_at: UtcDateTime | None

    @model_validator(mode="after")
    def _keys_together(self) -> Self:
        if (self.api_key_last4 is not None) != self.secret_saved:
            raise ValueError("apiKeyLast4 and secretSaved go together")
        return self


class KiteAppUpdate(Contract):
    """Body of `PATCH /broker/accounts/{id}/kite-app`: the app details, never the keys."""

    plan: Plan | None
    subscription_renews_on: IsoDate | None
    postback_url: Url | None
    static_ip: Ipv4 | None


class KiteKeysUpdate(Contract):
    """Body of `PUT /broker/accounts/{id}/kite-app/keys`; the passphrase seals the secret."""

    api_key: Annotated[str, Field(pattern=r"^[A-Za-z0-9]{6,64}$")]
    api_secret: Annotated[str, Field(min_length=1, max_length=128, pattern=r"^\S+$")]
    passphrase: Annotated[str, Field(min_length=12, max_length=128)]


class KitePassphrase(Contract):
    """Body of the passphrase check and of finishing a Kite login (D55)."""

    passphrase: Annotated[str, Field(min_length=1, max_length=128)]
