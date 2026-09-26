"""Backtest runs, results and trades (D25, D26, D37)."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    SmallInteger,
)
from sqlalchemy.orm import Mapped, mapped_column

from nova_db.enums import (
    BACKTEST_STAGES,
    BACKTEST_STATUSES,
    BENCHMARKS,
    EXCHANGES,
    SEGMENTS,
    SIDES,
    sql_in,
)
from nova_db.models.base import Base, Json, JsonList, check_in, created_at_column

PROGRESS_COUNTS = ("symbols_done", "symbols_total", "bars_done", "bars_total", "trades_so_far")


class BacktestRun(Base):
    __tablename__ = "backtest_runs"
    __table_args__ = (
        ForeignKeyConstraint(
            ["strategy_id", "strategy_version"],
            ["strategy_versions.strategy_id", "strategy_versions.version"],
        ),
        check_in("status", "status", BACKTEST_STATUSES),
        CheckConstraint(
            f"benchmark IS NULL OR {sql_in('benchmark', BENCHMARKS)}", name="benchmark"
        ),
        CheckConstraint("date_from <= date_to", name="period"),
        CheckConstraint("initial_capital_paise > 0", name="initial_capital"),
        CheckConstraint("error IS NULL OR status = 'failed'", name="error_only_failed"),
        check_in("stage", "stage", BACKTEST_STAGES),
        CheckConstraint("progress_percent BETWEEN 0 AND 100", name="progress_percent"),
        CheckConstraint(" AND ".join(f"{c} >= 0" for c in PROGRESS_COUNTS), name="progress_counts"),
        Index(None, "created_at", "id"),
        Index(None, "strategy_id", "created_at", "id"),
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
    benchmark: Mapped[str | None]
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
