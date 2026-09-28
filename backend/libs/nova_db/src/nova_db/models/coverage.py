"""Stored-data summary (D63): bars per IST day of each downloaded series, kept current by Atlas."""

from datetime import date, datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from nova_db.models.base import Base, check_in

COVERAGE_TIMEFRAMES = ("1m", "1d")


class CandleDay(Base):
    """One IST day of one series and its bar count; migration 0017 fills it, then downloads."""

    __tablename__ = "candle_days"
    __table_args__ = (
        check_in("timeframe", "timeframe", COVERAGE_TIMEFRAMES),
        CheckConstraint("bars > 0", name="bars"),
    )

    exchange: Mapped[str] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(primary_key=True)
    timeframe: Mapped[str] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(primary_key=True)
    bars: Mapped[int] = mapped_column(Integer)


class UnavailableDay(Base):
    """Evidence of a successful broker check with no usable candle on a known trading day."""

    __tablename__ = "unavailable_days"
    __table_args__ = (
        UniqueConstraint("exchange", "symbol", "timeframe", "day"),
        check_in("timeframe", "timeframe", COVERAGE_TIMEFRAMES),
        CheckConstraint("attempts > 0", name="attempts"),
        CheckConstraint("last_checked_at >= first_checked_at", name="check_order"),
        Index(None, "first_checked_at", "id"),
    )
    id: Mapped[str] = mapped_column(primary_key=True)
    exchange: Mapped[str]
    symbol: Mapped[str]
    timeframe: Mapped[str]
    day: Mapped[date]
    broker: Mapped[str]
    reason: Mapped[str]
    first_checked_at: Mapped[datetime]
    last_checked_at: Mapped[datetime]
    attempts: Mapped[int] = mapped_column(Integer)
    last_job_id: Mapped[str | None] = mapped_column(ForeignKey("data_jobs.id", ondelete="SET NULL"))
    last_check_id: Mapped[str]
    resolved_at: Mapped[datetime | None]
