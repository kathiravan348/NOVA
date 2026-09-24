"""Broker accounts, sessions (token encrypted in NOVA-049), profiles (D28), rate limits (D27)."""

from datetime import date, datetime

from sqlalchemy import CheckConstraint, ForeignKey, Integer, LargeBinary, func
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


class BrokerProfile(Base):
    __tablename__ = "broker_profiles"
    __table_args__ = (
        check_in("broker", "broker", BROKERS),
        CheckConstraint("api_key_last4 ~ '^[A-Za-z0-9]{4}$'", name="api_key_last4"),
    )

    broker: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    api: Mapped[str]
    plan: Mapped[str]
    subscription_renews_on: Mapped[date | None]
    api_key_last4: Mapped[str]
    redirect_url: Mapped[str]
    postback_url: Mapped[str | None]
    static_ip: Mapped[str | None]
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
