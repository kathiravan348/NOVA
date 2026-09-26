"""Data jobs, audit log, instruments and candles (TimescaleDB hypertable, D11)."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from nova_db.enums import (
    AUDIT_ACTIONS,
    AUDIT_TARGET_TYPES,
    DATA_JOB_STATUSES,
    DATA_JOB_TYPES,
    DOWNLOAD_MODES,
    EXCHANGES,
    JOB_STEP_STATUSES,
    MARKET_HOURS_MODES,
    SEGMENTS,
    TIMEFRAMES,
    sql_in,
)
from nova_db.models.base import Base, Json, check_in, created_at_column


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
        CheckConstraint("type = 'instrument_sync' OR cardinality(symbols) >= 1", name="symbols"),
        CheckConstraint("summary IS NULL OR char_length(summary) <= 500", name="summary"),
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
        CheckConstraint(
            "mode IS NULL OR (type = 'historical_download' AND "
            + sql_in("mode", DOWNLOAD_MODES)
            + ")",
            name="mode",
        ),
        CheckConstraint(
            "status <> 'draft' OR (started_at IS NULL AND finished_at IS NULL"
            " AND expires_at IS NOT NULL AND plan IS NOT NULL)",
            name="draft",
        ),
        CheckConstraint("expires_at IS NULL OR status = 'draft'", name="expires_only_draft"),
        CheckConstraint("steps_done BETWEEN 0 AND steps_total", name="steps"),
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
    # One line about the result, e.g. an instrument sync's counts (D56).
    summary: Mapped[str | None]
    # Planned downloads (D57): `skip_existing` or `overwrite`; the `DataJobPlan` shown before Start;
    # drafts not started by `expires_at` are removed.
    mode: Mapped[str | None]
    plan: Mapped[Json | None] = mapped_column(JSONB(none_as_null=True))
    expires_at: Mapped[datetime | None]
    # Kept in step with `data_job_steps` by the worker, so every step also announces the job.
    steps_total: Mapped[int] = mapped_column(Integer, server_default="0")
    steps_done: Mapped[int] = mapped_column(Integer, server_default="0")


class DataJobStep(Base):
    """One Kite-sized request of a download (stock × date chunk), saved as it finishes (D57)."""

    __tablename__ = "data_job_steps"
    __table_args__ = (
        check_in("status", "status", JOB_STEP_STATUSES),
        CheckConstraint("start_at < end_at", name="period"),
        CheckConstraint("seq >= 0 AND rows_written >= 0", name="counts"),
        CheckConstraint("(status = 'pending') = (finished_at IS NULL)", name="finished"),
        Index(None, "job_id", "status", "seq"),
    )

    job_id: Mapped[str] = mapped_column(
        ForeignKey("data_jobs.id", ondelete="CASCADE"), primary_key=True
    )
    seq: Mapped[int] = mapped_column(Integer, primary_key=True)
    symbol: Mapped[str]
    start_at: Mapped[datetime]
    end_at: Mapped[datetime]
    status: Mapped[str] = mapped_column(server_default="pending")
    rows_written: Mapped[int] = mapped_column(Integer, server_default="0")
    finished_at: Mapped[datetime | None]


class DownloadSetting(Base):
    """The one row (id 1) of download settings (D57): pace during market hours."""

    __tablename__ = "download_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="single_row"),
        check_in("market_hours_mode", "market_hours_mode", MARKET_HOURS_MODES),
    )

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    market_hours_mode: Mapped[str] = mapped_column(server_default="slow")
    updated_at: Mapped[datetime] = created_at_column()
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


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


class ChargeRate(Base):
    """Broker and statutory charge rates for a segment from a date on (NOVA Ledger, D42)."""

    __tablename__ = "charge_rates"
    __table_args__ = (
        check_in("segment", "segment", SEGMENTS),
        UniqueConstraint("segment", "effective_from"),
    )

    id: Mapped[str] = mapped_column(primary_key=True)
    segment: Mapped[str]
    effective_from: Mapped[date]
    rates: Mapped[Json]
    source: Mapped[str]
    created_at: Mapped[datetime] = created_at_column()


class Tick(Base):
    """One live tick from Kite's WebSocket (D11, D49); hypertable on `received_at` (rev 0004)."""

    __tablename__ = "ticks"
    __table_args__ = (
        check_in("exchange", "exchange", EXCHANGES),
        CheckConstraint("last_price_paise > 0 AND last_qty >= 0 AND volume >= 0", name="values"),
    )

    exchange: Mapped[str] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(primary_key=True)
    received_at: Mapped[datetime] = mapped_column(primary_key=True)
    exchange_ts: Mapped[datetime | None]
    last_price_paise: Mapped[int] = mapped_column(BigInteger)
    last_qty: Mapped[int] = mapped_column(BigInteger)
    volume: Mapped[int] = mapped_column(BigInteger)
    oi: Mapped[int | None] = mapped_column(BigInteger)


class UniverseEntry(Base):
    """The stock list the Owner edits in Relay (D54); `sync` adds Kite tokens to `instruments`."""

    __tablename__ = "universe"
    __table_args__ = (check_in("exchange", "exchange", EXCHANGES),)

    exchange: Mapped[str] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    sector: Mapped[str]
    # Names of `market_indices` rows; checked by the API on write (D56).
    indices: Mapped[list[str]] = mapped_column(server_default="{}")
    # Added by a sync after an earlier sync completed: a new listing such as an IPO (D56).
    new_listing: Mapped[bool] = mapped_column(server_default="false")
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = created_at_column()


class MarketIndex(Base):
    """An NSE index (D56): Kite gives its token, NSE's constituent file gives its members."""

    __tablename__ = "market_indices"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 1 AND 40", name="name"),
        CheckConstraint("member_count >= 0", name="member_count"),
    )

    name: Mapped[str] = mapped_column(primary_key=True)
    kite_symbol: Mapped[str] = mapped_column(unique=True)
    constituents_file: Mapped[str]
    instrument_token: Mapped[int | None] = mapped_column(BigInteger)
    member_count: Mapped[int] = mapped_column(Integer, server_default="0")
    updated_at: Mapped[datetime | None]
