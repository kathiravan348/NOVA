"""Stored-data summary (D63): bars per IST day of each downloaded series, kept current by Atlas."""

from datetime import date

from sqlalchemy import CheckConstraint, Integer
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
