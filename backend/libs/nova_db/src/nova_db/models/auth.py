"""Users and roles (D12: one super-admin in Phase 1; roles exist for later)."""

from datetime import datetime

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from nova_db.models.base import Base, created_at_column


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    created_at: Mapped[datetime] = created_at_column()
    last_login_at: Mapped[datetime | None]


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
