"""Backtest runs, results and trades (D25, D26, D37)."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR,
    BigInteger,
    CheckConstraint,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    false,
    func,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.engine.default import DefaultExecutionContext
from sqlalchemy.orm import Mapped, mapped_column

from nova_db.enums import (
    BACKTEST_DATA_SOURCES,
    BACKTEST_STAGES,
    BACKTEST_STATUSES,
    EXCHANGES,
    SCENARIOS,
    SEGMENTS,
    SIDES,
)
from nova_db.models.base import Base, Json, JsonList, check_in, created_at_column


def _own_id(context: DefaultExecutionContext) -> str:
    """A new run without a `root_id` starts its own chain (version 1)."""
    return str(context.get_current_parameters()["id"])  # type: ignore[no-untyped-call]


PROGRESS_COUNTS = ("symbols_done", "symbols_total", "bars_done", "bars_total", "trades_so_far")


class BacktestRun(Base):
    __tablename__ = "backtest_runs"
    __table_args__ = (
        ForeignKeyConstraint(
            ["strategy_id", "strategy_version"],
            ["strategy_versions.strategy_id", "strategy_versions.version"],
        ),
        check_in("status", "status", BACKTEST_STATUSES),
        CheckConstraint("date_from <= date_to", name="period"),
        CheckConstraint("initial_capital_paise > 0", name="initial_capital"),
        CheckConstraint("error IS NULL OR status = 'failed'", name="error_only_failed"),
        check_in("stage", "stage", BACKTEST_STAGES),
        CheckConstraint("progress_percent BETWEEN 0 AND 100", name="progress_percent"),
        CheckConstraint(" AND ".join(f"{c} >= 0" for c in PROGRESS_COUNTS), name="progress_counts"),
        Index(None, "created_at", "id"),
        Index(None, "strategy_id", "created_at", "id"),
        UniqueConstraint("root_id", "version"),
        CheckConstraint("version >= 1", name="version"),
        CheckConstraint("(version = 1) = (root_id = id)", name="root_first"),
        check_in("data_source", "data_source", BACKTEST_DATA_SOURCES),
        CheckConstraint(
            "recorded_days_used IS NULL OR recorded_days_used >= 0", name="recorded_days_used"
        ),
        # D84: intraday runs name a frozen research profile version and a scenario.
        ForeignKeyConstraint(
            ["profile_id", "profile_version"],
            ["research_profile_versions.profile_id", "research_profile_versions.version"],
        ),
        check_in("scenario", "scenario", SCENARIOS),
        CheckConstraint(
            "(profile_id IS NULL) = (profile_version IS NULL)"
            " AND (profile_id IS NULL) = (scenario IS NULL)",
            name="profile_choice",
        ),
    )

    id: Mapped[str] = mapped_column(primary_key=True)
    strategy_id: Mapped[str]
    strategy_version: Mapped[int] = mapped_column(Integer)
    name: Mapped[str]
    universe: Mapped[Json]
    status: Mapped[str]
    date_from: Mapped[date]
    date_to: Mapped[date]
    initial_capital_paise: Mapped[int] = mapped_column(BigInteger)
    benchmark: Mapped[str | None] = mapped_column(ForeignKey("market_indices.name"))
    created_at: Mapped[datetime] = created_at_column()
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]
    error: Mapped[str | None]
    # Progress while the worker runs it (D58); `stage` stays null until it starts.
    stage: Mapped[str | None]
    progress_percent: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    symbols_done: Mapped[int] = mapped_column(Integer, server_default="0")
    symbols_total: Mapped[int] = mapped_column(Integer, server_default="0")
    bars_done: Mapped[int] = mapped_column(Integer, server_default="0")
    bars_total: Mapped[int] = mapped_column(Integer, server_default="0")
    trades_so_far: Mapped[int] = mapped_column(Integer, server_default="0")
    simulated_to: Mapped[date | None]
    # Versions of one backtest share `root_id`, the first run's id (D60).
    root_id: Mapped[str] = mapped_column(default=_own_id)
    version: Mapped[int] = mapped_column(Integer, server_default="1")
    # False once a newer version completed: trades, curve and per-symbol rows are gone.
    report_kept: Mapped[bool] = mapped_column(server_default=true())
    skipped_symbols: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    # D82: `history` = Kite candles, `recorded` = candles built from recorded ticks.
    data_source: Mapped[str] = mapped_column(server_default="history")
    recorded_days_used: Mapped[int | None] = mapped_column(Integer)
    recorded_days_skipped: Mapped[list[date]] = mapped_column(
        ARRAY(Date), server_default=text("'{}'")
    )
    # D84 (NOVA-185): intraday runs only (null / false / empty on every other run).
    profile_id: Mapped[str | None]
    profile_version: Mapped[int | None] = mapped_column(Integer)
    scenario: Mapped[str | None]
    experiment_id: Mapped[str | None]  # NOVA-193 adds the experiments table
    # An unresolved position (no bid by the session end) makes the run incomplete.
    incomplete: Mapped[bool] = mapped_column(server_default=false())
    # Inputs taken from Kite history instead of recorded ticks, e.g. `tick_size:INFY`.
    history_inputs: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))


class BacktestResult(Base):
    __tablename__ = "backtest_results"
    __table_args__ = (
        CheckConstraint("net_pnl_paise = gross_pnl_paise - charges_paise", name="net_pnl"),
        CheckConstraint("charges_paise >= 0", name="charges"),
        CheckConstraint("max_drawdown_percent <= 0", name="drawdown"),
        CheckConstraint("win_rate_percent BETWEEN 0 AND 100", name="win_rate"),
        CheckConstraint(
            "win_count >= 0 AND loss_count >= 0 AND win_count + loss_count <= trade_count",
            name="counts",
        ),
        CheckConstraint("exposure_percent BETWEEN 0 AND 100", name="exposure"),
        CheckConstraint("estimated_tax_paise >= 0", name="tax"),
    )

    run_id: Mapped[str] = mapped_column(
        ForeignKey("backtest_runs.id", ondelete="CASCADE"), primary_key=True
    )
    gross_pnl_paise: Mapped[int] = mapped_column(BigInteger)
    charges_paise: Mapped[int] = mapped_column(BigInteger)
    net_pnl_paise: Mapped[int] = mapped_column(BigInteger)
    return_percent: Mapped[Decimal]
    cagr_percent: Mapped[Decimal]
    max_drawdown_percent: Mapped[Decimal]
    sharpe: Mapped[Decimal]
    win_rate_percent: Mapped[Decimal]
    trade_count: Mapped[int] = mapped_column(Integer)
    win_count: Mapped[int] = mapped_column(Integer)
    loss_count: Mapped[int] = mapped_column(Integer)
    equity_curve: Mapped[JsonList]
    by_symbol: Mapped[JsonList]
    # D62 (6), migration 0018: null on older results and where they do not apply (tax: delivery).
    benchmark_return_percent: Mapped[Decimal | None] = mapped_column(Numeric())
    benchmark_cagr_percent: Mapped[Decimal | None] = mapped_column(Numeric())
    exposure_percent: Mapped[Decimal | None] = mapped_column(Numeric())
    avg_hold_days: Mapped[Decimal | None] = mapped_column(Numeric())
    profit_factor: Mapped[Decimal | None] = mapped_column(Numeric())
    calmar: Mapped[Decimal | None] = mapped_column(Numeric())
    after_tax_cagr_percent: Mapped[Decimal | None] = mapped_column(Numeric())
    estimated_tax_paise: Mapped[int | None] = mapped_column(BigInteger)
    after_tax_net_pnl_paise: Mapped[int | None] = mapped_column(BigInteger)
    years: Mapped[JsonList] = mapped_column(server_default=text("'[]'::jsonb"))
    # D82: fills vs last price on recorded runs; null for history runs.
    spread_cost_paise: Mapped[int | None] = mapped_column(BigInteger)


CHARGE_COLUMNS = (
    "brokerage_paise",
    "stt_paise",
    "exchange_txn_paise",
    "sebi_fee_paise",
    "stamp_duty_paise",
    "gst_paise",
    "dp_paise",
)


class Trade(Base):
    __tablename__ = "trades"
    __table_args__ = (
        check_in("exchange", "exchange", EXCHANGES),
        check_in("segment", "segment", SEGMENTS),
        check_in("side", "side", SIDES),
        check_in(
            "exit_reason",
            "exit_reason",
            (
                "signal",
                "stop",
                "target",
                "time_exit",
                "square_off",
                "market_filter",
                "rotation",
                "end_of_period",
                "daily_shutdown",
                "unresolved",
            ),
        ),
        CheckConstraint("qty > 0 AND entry_price_paise > 0", name="entry"),
        CheckConstraint(
            "(exit_at IS NULL AND exit_price_paise IS NULL)"
            " OR (exit_at IS NOT NULL AND exit_price_paise IS NOT NULL AND exit_price_paise > 0)",
            name="exit_pair",
        ),
        CheckConstraint(" AND ".join(f"{c} >= 0" for c in CHARGE_COLUMNS), name="charges"),
        CheckConstraint(
            f"charges_total_paise = {' + '.join(CHARGE_COLUMNS)}", name="charges_total"
        ),
        CheckConstraint("net_pnl_paise = gross_pnl_paise - charges_total_paise", name="net_pnl"),
        Index(None, "run_id", "entry_at", "id"),
    )

    id: Mapped[str] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("backtest_runs.id", ondelete="CASCADE"))
    symbol: Mapped[str]
    exchange: Mapped[str]
    segment: Mapped[str]
    side: Mapped[str]
    qty: Mapped[int] = mapped_column(Integer)
    entry_at: Mapped[datetime]
    entry_price_paise: Mapped[int] = mapped_column(BigInteger)
    exit_at: Mapped[datetime | None]
    exit_price_paise: Mapped[int | None] = mapped_column(BigInteger)
    exit_reason: Mapped[str | None]
    gross_pnl_paise: Mapped[int] = mapped_column(BigInteger)
    brokerage_paise: Mapped[int] = mapped_column(BigInteger)
    stt_paise: Mapped[int] = mapped_column(BigInteger)
    exchange_txn_paise: Mapped[int] = mapped_column(BigInteger)
    sebi_fee_paise: Mapped[int] = mapped_column(BigInteger)
    stamp_duty_paise: Mapped[int] = mapped_column(BigInteger)
    gst_paise: Mapped[int] = mapped_column(BigInteger)
    dp_paise: Mapped[int] = mapped_column(BigInteger)
    charges_total_paise: Mapped[int] = mapped_column(BigInteger)
    net_pnl_paise: Mapped[int] = mapped_column(BigInteger)


class ResearchProfile(Base):
    """D84: versioned shared settings of intraday runs (`docs/INTRADAY-RESEARCH.md` §2)."""

    __tablename__ = "research_profiles"
    __table_args__ = (CheckConstraint("char_length(name) BETWEEN 1 AND 80", name="name"),)

    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    description: Mapped[str] = mapped_column(server_default="")
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ResearchProfileVersion(Base):
    """A draft changes; a frozen version never does and carries the SHA-256 of its settings."""

    __tablename__ = "research_profile_versions"
    __table_args__ = (
        CheckConstraint("version >= 1", name="version"),
        CheckConstraint(
            "frozen = (hash IS NOT NULL) AND frozen = (frozen_at IS NOT NULL)", name="frozen"
        ),
    )

    profile_id: Mapped[str] = mapped_column(
        ForeignKey("research_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    note: Mapped[str] = mapped_column(server_default="")
    settings: Mapped[Json]
    frozen: Mapped[bool] = mapped_column(server_default=false())
    hash: Mapped[str | None] = mapped_column(CHAR(64))
    created_at: Mapped[datetime] = created_at_column()
    frozen_at: Mapped[datetime | None]


class IntradayTrade(Base):
    """D84 (NOVA-185): the intraday details of a trade; the trade row keeps qty, average entry
    price, exit and charges."""

    __tablename__ = "intraday_trades"
    __table_args__ = (
        CheckConstraint(
            "stop_paise > 0 AND first_fill_paise > stop_paise AND risk_paise > 0", name="levels"
        ),
        CheckConstraint("target_paise IS NULL OR target_paise > 0", name="target"),
    )

    trade_id: Mapped[str] = mapped_column(
        ForeignKey("trades.id", ondelete="CASCADE"), primary_key=True
    )
    stop_paise: Mapped[int] = mapped_column(BigInteger)
    target_paise: Mapped[int | None] = mapped_column(BigInteger)
    first_fill_paise: Mapped[int] = mapped_column(BigInteger)
    # 1R per share: first fill − stop.
    risk_paise: Mapped[int] = mapped_column(BigInteger)
    # Every buy: [{"at": ISO UTC, "qty": n, "price": paise}] (average price of that buy's fills).
    legs: Mapped[JsonList]
    unresolved: Mapped[bool] = mapped_column(server_default=false())
