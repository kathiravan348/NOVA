"""Strategies and their immutable versions (spec = `StrategySpec` JSON, D9, D25)."""

from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from nova_db.enums import STRATEGY_STATUSES
from nova_db.models.base import Base, Json, check_in, created_at_column


class Strategy(Base):
    __tablename__ = "strategies"
    __table_args__ = (
        check_in("status", "status", STRATEGY_STATUSES),
        CheckConstraint("latest_version >= 1", name="latest_version"),
    )

    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    description: Mapped[str] = mapped_column(server_default="")
    status: Mapped[str]
    latest_version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class StrategyVersion(Base):
    __tablename__ = "strategy_versions"
    __table_args__ = (CheckConstraint("version >= 1", name="version"),)

    strategy_id: Mapped[str] = mapped_column(
        ForeignKey("strategies.id", ondelete="CASCADE"), primary_key=True
    )
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = created_at_column()
    note: Mapped[str] = mapped_column(server_default="")
    spec: Mapped[Json]
