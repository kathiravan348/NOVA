"""Data jobs, audit log, instruments and candles (TimescaleDB hypertable, D11)."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Index, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from nova_db.enums import (
    AUDIT_ACTIONS,
    AUDIT_TARGET_TYPES,
    DATA_JOB_STATUSES,
    DATA_JOB_TYPES,
    EXCHANGES,
    SEGMENTS,
    TIMEFRAMES,
    sql_in,
)
from nova_db.models.base import Base, check_in, created_at_column


class DataJob(Base):
    __tablename__ = "data_jobs"
    __table_args__ = (
        check_in("type", "type", DATA_JOB_TYPES),
        check_in("status", "status", DATA_JOB_STATUSES),
        check_in("exchange", "exchange", EXCHANGES),
        check_in("segment", "segment", SEGMENTS),
        CheckConstraint(
            f"timeframe IS NULL OR {sql_in('timeframe', TIMEFRAMES)}", name="timeframe"
        ),
        CheckConstraint("cardinality(symbols) >= 1", name="symbols"),
        CheckConstraint(
            "type <> 'historical_download' OR"
            " (timeframe IS NOT NULL AND date_from IS NOT NULL AND date_to IS NOT NULL)",
            name="download_needs_period",
        ),
        CheckConstraint("type <> 'tick_record' OR timeframe IS NULL", name="ticks_no_timeframe"),
        CheckConstraint(
            "(date_from IS NULL AND date_to IS NULL)"
            " OR (date_from IS NOT NULL AND date_to IS NOT NULL AND date_from <= date_to)",
            name="period",
        ),
        CheckConstraint(
            "progress_percent BETWEEN 0 AND 100 AND rows_written >= 0", name="progress"
        ),
        CheckConstraint("error IS NULL OR status = 'failed'", name="error_only_failed"),
        CheckConstraint(
            "status <> 'completed' OR (progress_percent = 100 AND finished_at IS NOT NULL)",
            name="completed",
        ),
        CheckConstraint(
            "status <> 'queued' OR (started_at IS NULL AND finished_at IS NULL)", name="queued"
        ),
        Index(None, "created_at", "id"),
    )

    id: Mapped[str] = mapped_column(primary_key=True)
    type: Mapped[str]
    status: Mapped[str]
    exchange: Mapped[str]
    segment: Mapped[str]
    symbols: Mapped[list[str]]
    timeframe: Mapped[str | None]
    date_from: Mapped[date | None]
    date_to: Mapped[date | None]
    progress_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), server_default="0")
    rows_written: Mapped[int] = mapped_column(BigInteger, server_default="0")
    created_at: Mapped[datetime] = created_at_column()
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]
    error: Mapped[str | None]


class AuditEntry(Base):
    __tablename__ = "audit_entries"
    __table_args__ = (
        check_in("action", "action", AUDIT_ACTIONS),
        CheckConstraint(
            f"target_type IS NULL OR {sql_in('target_type', AUDIT_TARGET_TYPES)}",
            name="target_type",
        ),
        CheckConstraint("(target_type IS NULL) = (target_id IS NULL)", name="target_pair"),
        Index(None, "at", "id"),
    )

    id: Mapped[str] = mapped_column(primary_key=True)
    at: Mapped[datetime] = created_at_column()
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    actor_name: Mapped[str]
    action: Mapped[str]
    target_type: Mapped[str | None]
    target_id: Mapped[str | None]
    summary: Mapped[str]
    ip: Mapped[str | None]


class Instrument(Base):
    """Master data only; last close, 52-week range, volume and coverage come from candles."""

    __tablename__ = "instruments"
    __table_args__ = (
        check_in("exchange", "exchange", EXCHANGES),
        check_in("segment", "segment", SEGMENTS),
        CheckConstraint("lot_size IS NULL OR lot_size > 0", name="lot_size"),
    )

    exchange: Mapped[str] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    segment: Mapped[str]
    sector: Mapped[str]
    indices: Mapped[list[str]] = mapped_column(server_default="{}")
    lot_size: Mapped[int | None] = mapped_column(Integer)
    instrument_token: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    updated_at: Mapped[datetime] = created_at_column()


class Candle(Base):
    """One OHLCV bar. Hypertable on `ts` (migration 0001). Daily bars are stored at 00:00 IST."""

    __tablename__ = "candles"
    __table_args__ = (
        check_in("timeframe", "timeframe", TIMEFRAMES),
        CheckConstraint(
            "open_paise > 0 AND low_paise > 0 AND volume >= 0"
            " AND high_paise >= GREATEST(open_paise, close_paise)"
            " AND low_paise <= LEAST(open_paise, close_paise)",
            name="ohlc",
        ),
    )

    exchange: Mapped[str] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(primary_key=True)
    timeframe: Mapped[str] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(primary_key=True)
    open_paise: Mapped[int] = mapped_column(BigInteger)
    high_paise: Mapped[int] = mapped_column(BigInteger)
    low_paise: Mapped[int] = mapped_column(BigInteger)
    close_paise: Mapped[int] = mapped_column(BigInteger)
    volume: Mapped[int] = mapped_column(BigInteger)
