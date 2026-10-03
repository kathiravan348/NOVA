"""Backtest contracts: mirror `frontend/packages/contracts/src/backtest.ts` (D25, D44)."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import (
    Contract,
    DataSource,
    Id,
    IsoDate,
    NonNegPaise,
    Paise,
    Segment,
    StrategyTimeframe,
    UtcDateTime,
)
from nova_contracts.market_data import IndexName
from nova_contracts.trade import ExitReason
from nova_contracts.universe import Symbol

BacktestRunStatus = Literal["queued", "running", "completed", "failed"]
BacktestStage = Literal["loading", "signals", "simulating", "saving", "done"]
BacktestBenchmark = IndexName
Count = Annotated[int, Field(ge=0)]
NonEmpty = Annotated[str, Field(min_length=1)]
Percent = Annotated[float, Field(ge=0, le=100)]


class LedgerDay(Contract):
    date: IsoDate
    buys: Count
    sells: Count
    bought_paise: NonNegPaise
    sold_paise: NonNegPaise
    charges_paise: NonNegPaise
    net_pnl_paise: Paise
    cash_paise: Paise
    holdings_paise: Paise
    equity_paise: Paise
    open_positions: Count


class LedgerEvent(Contract):
    at: UtcDateTime
    entry_at: UtcDateTime | None
    symbol: NonEmpty
    side: Literal["buy", "sell"]
    qty: Annotated[int, Field(gt=0)]
    price_paise: Annotated[int, Field(gt=0)]
    amount_paise: NonNegPaise
    charges_paise: NonNegPaise
    net_pnl_paise: Paise | None
    reason: ExitReason | None
    cash_after_paise: Paise


class UniverseSymbols(Contract):
    type: Literal["symbols"]
    symbols: Annotated[list[NonEmpty], Field(min_length=1)]


class UniverseIndex(Contract):
    type: Literal["index"]
    index: IndexName


Universe = Annotated[UniverseSymbols | UniverseIndex, Field(discriminator="type")]


class _Period(Contract):
    from_: IsoDate = Field(alias="from")
    to: IsoDate = Field(alias="to")

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.from_ > self.to:
            raise ValueError("from date must be less than or equal to to date")
        return self


class BacktestProgress(Contract):
    """What a started run is doing (D58); a failed run keeps its last progress."""

    stage: BacktestStage
    percent: Annotated[int, Field(ge=0, le=100)]
    symbols_done: Count
    symbols_total: Count
    bars_done: Count
    bars_total: Count
    trades_so_far: Count
    simulated_to: IsoDate | None


class BacktestRun(_Period):
    id: Id
    strategy_id: Id
    strategy_version: Annotated[int, Field(ge=1)]
    name: NonEmpty
    universe: Universe
    status: BacktestRunStatus
    initial_capital_paise: Annotated[int, Field(gt=0)]
    benchmark: BacktestBenchmark | None
    created_at: UtcDateTime
    started_at: UtcDateTime | None
    finished_at: UtcDateTime | None
    error: str | None
    progress: BacktestProgress | None
    # D60: versions of one backtest share `root_id` (the first run's id).
    root_id: Id
    version: Annotated[int, Field(ge=1)]
    report_kept: bool
    skipped_symbols: list[Symbol]
    # D82: `recorded` runs use candles built from recorded ticks; days are set when it ran.
    data_source: DataSource
    recorded_days_used: Count | None
    recorded_days_skipped: list[IsoDate]

    @model_validator(mode="after")
    def _root_is_first_version(self) -> Self:
        if (self.version == 1) != (self.root_id == self.id):
            raise ValueError("rootId equals id exactly for version 1")
        return self

    @model_validator(mode="after")
    def _error_only_failed(self) -> Self:
        if self.error is not None and self.status != "failed":
            raise ValueError("error is set only when status is failed")
        return self

    @model_validator(mode="after")
    def _completed_is_done(self) -> Self:
        done = self.progress is not None and (self.progress.stage, self.progress.percent) == (
            "done",
            100,
        )
        if self.status == "completed" and not done:
            raise ValueError("a completed run has progress done at 100 percent")
        return self


class BacktestRunSummary(Contract):
    """A completed run's key results for the Backtests list (D82 (6))."""

    net_pnl_paise: Paise
    return_percent: float
    cagr_percent: float
    max_drawdown_percent: Annotated[float, Field(le=0)]
    win_rate_percent: Percent
    trade_count: Count
    profit_factor: Annotated[float, Field(ge=0)] | None
    sharpe: float
    after_tax_cagr_percent: float | None
    spread_cost_paise: NonNegPaise | None


class BacktestRunListItem(BacktestRun):
    """`GET /backtests` rows: the run, its strategy version's segment and timeframe, and its
    results (`summary` null until completed), D82 (6)."""

    segment: Segment
    timeframe: StrategyTimeframe
    summary: BacktestRunSummary | None


BacktestListSort = Literal[
    "created",
    "netPnl",
    "return",
    "cagr",
    "maxDrawdown",
    "winRate",
    "profitFactor",
    "sharpe",
    "trades",
]


class BacktestRunCreate(_Period):
    """Body of `POST /backtests` (D44)."""

    strategy_id: Id
    strategy_version: Annotated[int, Field(ge=1)]
    name: NonEmpty
    universe: Universe
    initial_capital_paise: Annotated[int, Field(gt=0)]
    benchmark: BacktestBenchmark | None
    data_source: DataSource = "history"


class BacktestVersionCreate(_Period):
    """Body of `POST /backtests/{id}/versions` (D60): the next version of the same strategy."""

    strategy_version: Annotated[int, Field(ge=1)]
    name: NonEmpty
    universe: Universe
    initial_capital_paise: Annotated[int, Field(gt=0)]
    benchmark: BacktestBenchmark | None
    # Absent = the previous version's source (D82).
    data_source: DataSource | None = None


class BacktestDeleteRequest(Contract):
    """Body of `POST /backtests/delete` (D60): whole backtests, every version."""

    ids: Annotated[list[Id], Field(min_length=1, max_length=100)]


class BacktestDeleteResult(Contract):
    deleted_runs: Count


class BacktestMetrics(Contract):
    gross_pnl_paise: Paise
    charges_paise: NonNegPaise
    net_pnl_paise: Paise
    return_percent: float
    cagr_percent: float
    max_drawdown_percent: Annotated[float, Field(le=0)]
    sharpe: float
    win_rate_percent: Percent
    trade_count: Count
    win_count: Count
    loss_count: Count
    # D62 (6): always sent, null for older runs or when they do not apply (tax: delivery only).
    benchmark_return_percent: float | None = None
    benchmark_cagr_percent: float | None = None
    exposure_percent: Annotated[float, Field(ge=0, le=100)] | None = None
    avg_hold_days: Annotated[float, Field(ge=0)] | None = None
    profit_factor: Annotated[float, Field(ge=0)] | None = None
    calmar: float | None = None
    estimated_tax_paise: NonNegPaise | None = None
    after_tax_net_pnl_paise: Paise | None = None
    after_tax_cagr_percent: float | None = None
    # D82: recorded runs only: Σ |fill − last price| × qty.
    spread_cost_paise: NonNegPaise | None = None

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        if self.net_pnl_paise != self.gross_pnl_paise - self.charges_paise:
            raise ValueError("netPnlPaise must equal grossPnlPaise minus chargesPaise")
        if self.win_count + self.loss_count > self.trade_count:
            raise ValueError("winCount + lossCount must be at most tradeCount")
        return self


class EquityPoint(Contract):
    date: IsoDate
    equity_paise: Paise
    benchmark_paise: Paise | None


class SymbolBreakdown(Contract):
    symbol: NonEmpty
    trade_count: Count
    win_count: Count
    loss_count: Count
    win_rate_percent: Percent
    net_pnl_paise: Paise

    @model_validator(mode="after")
    def _counts(self) -> Self:
        if self.win_count + self.loss_count > self.trade_count:
            raise ValueError("winCount + lossCount must not exceed tradeCount")
        return self


class YearRow(_Period):
    """One 12-month block from the run's start date (the last may be short), D62 (6)."""

    year: Annotated[int, Field(ge=1)]
    return_percent: float
    profit_paise: Paise
    max_drawdown_percent: Annotated[float, Field(le=0)]
    benchmark_percent: float | None


class BacktestResult(Contract):
    run_id: Id
    metrics: BacktestMetrics
    equity_curve: list[EquityPoint]
    by_symbol: list[SymbolBreakdown]
    # Year-by-year results (D62); empty for older runs.
    years: list[YearRow] = Field(default_factory=list)

    @model_validator(mode="after")
    def _unique_symbols(self) -> Self:
        if len({row.symbol for row in self.by_symbol}) != len(self.by_symbol):
            raise ValueError("bySymbol must list each symbol once")
        return self


class BacktestVersion(_Period):
    """One version of a backtest in its history (D60); metrics only when completed."""

    run_id: Id
    version: Annotated[int, Field(ge=1)]
    status: BacktestRunStatus
    strategy_version: Annotated[int, Field(ge=1)]
    name: NonEmpty
    universe: Universe
    initial_capital_paise: Annotated[int, Field(gt=0)]
    benchmark: BacktestBenchmark | None
    created_at: UtcDateTime
    error: str | None
    report_kept: bool
    data_source: DataSource
    recorded_days_used: Count | None
    recorded_days_skipped: list[IsoDate]
    metrics: BacktestMetrics | None

    @model_validator(mode="after")
    def _metrics_when_completed(self) -> Self:
        if (self.metrics is not None) != (self.status == "completed"):
            raise ValueError("metrics are set exactly when the version completed")
        return self
