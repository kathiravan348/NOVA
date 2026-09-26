"""Broker accounts, sessions (NOVA-049), Kite apps (D55), profiles (D28), rate limits (D27)."""

from datetime import date, datetime

from sqlalchemy import CheckConstraint, ForeignKey, Integer, LargeBinary, SmallInteger, func
from sqlalchemy.orm import Mapped, mapped_column

from nova_db.enums import BROKERS, RATE_LIMIT_ENDPOINTS, RATE_LIMIT_WINDOWS
from nova_db.models.base import Base, JsonList, check_in, created_at_column


class BrokerAccount(Base):
    __tablename__ = "broker_accounts"
    __table_args__ = (check_in("broker", "broker", BROKERS),)

    id: Mapped[str] = mapped_column(primary_key=True)
    broker: Mapped[str]
    label: Mapped[str]
    client_id: Mapped[str] = mapped_column(unique=True)
    enabled: Mapped[bool] = mapped_column(server_default="true")
    created_at: Mapped[datetime] = created_at_column()


class BrokerSession(Base):
    """Current session of an account.

    Status is derived: no token = not logged in; past `expires_at` = expired.
    """

    __tablename__ = "broker_sessions"
    __table_args__ = (
        CheckConstraint(
            "(access_token_encrypted IS NULL) = (logged_in_at IS NULL)"
            " AND (logged_in_at IS NULL) = (expires_at IS NULL)",
            name="login_triple",
        ),
        CheckConstraint("logged_in_at < expires_at", name="expiry_after_login"),
    )

    account_id: Mapped[str] = mapped_column(
        ForeignKey("broker_accounts.id", ondelete="CASCADE"), primary_key=True
    )
    access_token_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    logged_in_at: Mapped[datetime | None]
    expires_at: Mapped[datetime | None]


class BrokerKiteApp(Base):
    """The Kite Connect app of one account (D55): each family member has their own.

    The API key is plain (it is public in the login URL); the secret is sealed with the Owner's
    passphrase (`nova_broker.vault`). Key and secret are saved together.
    """

    __tablename__ = "broker_kite_apps"
    __table_args__ = (
        CheckConstraint("(api_key IS NULL) = (api_secret_sealed IS NULL)", name="keys_together"),
        CheckConstraint("api_key ~ '^[A-Za-z0-9]{6,64}$'", name="api_key"),
    )

    account_id: Mapped[str] = mapped_column(
        ForeignKey("broker_accounts.id", ondelete="CASCADE"), primary_key=True
    )
    api_key: Mapped[str | None]
    api_secret_sealed: Mapped[bytes | None] = mapped_column(LargeBinary)
    plan: Mapped[str | None]
    subscription_renews_on: Mapped[date | None]
    postback_url: Mapped[str | None]
    static_ip: Mapped[str | None]
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class BrokerProfile(Base):
    """Broker facts from the repo data file (D28); app details live in `broker_kite_apps` (D55)."""

    __tablename__ = "broker_profiles"
    __table_args__ = (check_in("broker", "broker", BROKERS),)

    broker: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    api: Mapped[str]
    session_rule: Mapped[str]
    links: Mapped[JsonList] = mapped_column(server_default="[]")


class RateLimitRule(Base):
    """Broker and NOVA limit per endpoint × window. Live usage lives in Redis (NOVA-050)."""

    __tablename__ = "rate_limit_rules"
    __table_args__ = (
        check_in("endpoint", "endpoint", RATE_LIMIT_ENDPOINTS),
        check_in("rate_window", "rate_window", RATE_LIMIT_WINDOWS),
        CheckConstraint("nova_limit > 0 AND nova_limit <= broker_limit", name="nova_limit"),
    )

    account_id: Mapped[str] = mapped_column(
        ForeignKey("broker_accounts.id", ondelete="CASCADE"), primary_key=True
    )
    endpoint: Mapped[str] = mapped_column(primary_key=True)
    # The contract field is `window`, a reserved word in SQL.
    rate_window: Mapped[str] = mapped_column(primary_key=True)
    broker_limit: Mapped[int] = mapped_column(Integer)
    nova_limit: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class RecorderSetting(Base):
    """The one row (id 1) that switches live tick recording on or off (D54).

    `symbols` empty = every instrument with a Kite token.
    """

    __tablename__ = "recorder_settings"
    __table_args__ = (CheckConstraint("id = 1", name="single_row"),)

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    enabled: Mapped[bool] = mapped_column(server_default="false")
    symbols: Mapped[list[str]] = mapped_column(server_default="{}")
    updated_at: Mapped[datetime] = created_at_column()
