"""Users and roles (D12: one super-admin in Phase 1; roles exist for later)."""

from datetime import datetime

from pydantic import JsonValue
from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from nova_db.models.base import Base, check_in, created_at_column


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    created_at: Mapped[datetime] = created_at_column()
    last_login_at: Mapped[datetime | None]
    disabled_at: Mapped[datetime | None]


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"), primary_key=True)


class AuthSession(Base):
    """A signed-in browser (D38): `id` is the SHA-256 of the cookie token, never the token."""

    __tablename__ = "auth_sessions"
    __table_args__ = (Index(None, "user_id"),)

    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = created_at_column()
    expires_at: Mapped[datetime]
    ip: Mapped[str | None]
    user_agent: Mapped[str | None]


class ApprovalRequest(Base):
    """A held agent write; only Core may replay it after approval (D67)."""

    __tablename__ = "approval_requests"
    __table_args__ = (
        check_in("method", "method", ("POST", "PUT", "PATCH", "DELETE")),
        check_in("status", "status", ("pending", "done", "failed", "rejected", "expired")),
        Index(None, "status", "created_at"),
    )

    id: Mapped[str] = mapped_column(primary_key=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    method: Mapped[str]
    path: Mapped[str]
    query: Mapped[str] = mapped_column(server_default=text("''"))
    body: Mapped[JsonValue | None] = mapped_column(JSONB(none_as_null=True), nullable=True)
    status: Mapped[str] = mapped_column(server_default=text("'pending'"))
    created_at: Mapped[datetime] = created_at_column()
    decided_at: Mapped[datetime | None]
    decided_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    result_status: Mapped[int | None]
    result_body: Mapped[str | None]
