"""Backtest engine (D45, D46, D47): visual and Python strategies, equity delivery and intraday."""

from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

import numpy as np
from nova_contracts import BacktestResult as ResultContract
from nova_contracts import Charges, StrategySpec
from nova_contracts.strategy import (
    OperandIndicator,
    OperandPrice,
    StrategySpecPython,
    StrategySpecRotation,
    StrategySpecVisual,
    spec_operands,
)
from nova_db import new_id
from nova_db.models import BacktestResult, BacktestRun, Instrument, StrategyVersion, Trade
from nova_ledger import ChargeRates, rates_for, trade_charges
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from nova_backtest.bars import IST
from nova_backtest.columns import Columns
from nova_backtest.columns import load as load_columns
from nova_backtest.engine import EngineError
from nova_backtest.metrics import summarize
from nova_backtest.progress import ProgressSink
from nova_backtest.rules import check_group
from nova_backtest.rules import signals as rule_signals
from nova_backtest.sandbox import run_python
from nova_backtest.scratch import RunScratch
from nova_backtest.simulate import simulate
from nova_backtest.versions import trim_older_versions

SPEC = TypeAdapter[StrategySpec](StrategySpec)
WARM_UP_DAYS = {"1d": 400}
# Zerodha squares off MIS equity positions from 15:20 IST (D46).
SQUARE_OFF = time(15, 20)
INTRADAY_WARM_UP_DAYS = 30
DEFAULT_SCRATCH = Path("/tmp/nova-backtest")  # noqa: S108 - the worker container's own disk (D61)


def unsupported(spec: StrategySpec) -> str | None:
    """D62 settings the engine cannot run yet; a run must fail rather than ignore one."""
    if isinstance(spec, StrategySpecRotation):
        return "rotation"
    risk = spec.risk
    found = [
        name
        for name, used in (
            ("a market filter", spec.regime is not None),
            ("a portfolio limit", spec.portfolio is not None),
            ("a trailing stop", risk.trailing_stop_percent is not None),
            ("an ATR stop", risk.atr_stop is not None),
            ("an exit after N bars", risk.max_hold_bars is not None),
            (
                "a multiplier",
                any(
                    isinstance(o, OperandPrice | OperandIndicator) and o.multiplier is not None
                    for o in spec_operands(spec)
                ),
            ),
        )
        if used
    ]
    return ", ".join(found) or None


def _spec(db: Session, run: BacktestRun) -> StrategySpecVisual | StrategySpecPython:
    version = db.get(StrategyVersion, (run.strategy_id, run.strategy_version))
    if version is None:
        raise EngineError("The strategy version of this run no longer exists")
    try:
        spec = SPEC.validate_python(version.spec)
    except ValidationError as exc:
        raise EngineError("The stored strategy spec is not valid") from exc
    features = unsupported(spec)
    if features is not None or isinstance(spec, StrategySpecRotation):
        raise EngineError(f"This strategy uses {features}, which backtests do not support yet")
    if spec.segment not in ("equity_delivery", "equity_intraday"):
        raise EngineError(f"{spec.segment} backtests are not supported yet")
    if spec.segment == "equity_intraday" and spec.timeframe == "1d":
        raise EngineError("Intraday strategies need an intraday timeframe")
    return spec


def _symbols(db: Session, run: BacktestRun) -> list[str]:
    universe = run.universe
    if universe["type"] == "symbols":
        return list(universe["symbols"])
    rows = db.scalars(
        select(Instrument.symbol)
        .where(Instrument.exchange == "NSE", Instrument.indices.any(universe["index"]))
        .order_by(Instrument.symbol)
    ).all()
    if not rows:
        raise EngineError(
            f"No instruments are in {universe['index']}: sync with Kite on Relay's Instruments page"
        )
    return list(rows)


def _ist_midnight(day: date) -> datetime:
    return datetime.combine(day, time(0, 0), tzinfo=IST).astimezone(UTC)


class StrategyEngine:
    def __init__(
        self,
        max_bars: int = 1_500_000,
        max_bars_python: int = 750_000,
        scratch_root: Path = DEFAULT_SCRATCH,
    ) -> None:
        self.scratch_root = scratch_root
        self.max_bars = max_bars
        self.max_bars_python = max_bars_python

    def _load(
        self,
        db: Session,
        symbols: list[str],
        spec: StrategySpecVisual | StrategySpecPython,
        span: tuple[datetime, datetime],
        limit: int,
        progress: ProgressSink,
        scratch: RunScratch,
        start: datetime,
    ) -> int:
        """Pass 1 (D61): one stock at a time, its columns and signals go to `scratch`.

        Visual signals are computed right after each stock loads, so only one stock's indicator
        arrays exist at a time. Stops as soon as the run passes the bar limit (D59); 3m–1h are
        rolled up from 1m (D58). Answers the number of bars stored.
        """
        progress.stage("loading", len(symbols))
        if isinstance(spec, StrategySpecVisual):
            check_group(spec.entry)
            check_group(spec.exit)
        waiting: dict[str, Columns] = {}  # Python mode: every stock, for one sandbox run
        missing: list[str] = []
        first, total = int(start.timestamp()), 0
        for done, symbol in enumerate(symbols, start=1):
            columns = load_columns(db, "NSE", symbol, spec.timeframe, *span)
            total += len(columns)
            if total > limit:
                raise EngineError(
                    f"This run needs more than {limit:,} price bars (stopped at {symbol}). "
                    "Pick fewer stocks or a shorter period."
                )
            if len(columns) == 0 or int(columns.ts[-1]) < first:
                missing.append(symbol)
            elif isinstance(spec, StrategySpecVisual):
                scratch.add(symbol, columns, *rule_signals(columns, spec.entry, spec.exit))
            else:
                waiting[symbol] = columns
            progress.advance(done)
        if missing:
            raise EngineError(
                f"No {spec.timeframe} candles in the period for {', '.join(missing)} "
                "(download them first)"
            )
        if isinstance(spec, StrategySpecPython):
            progress.stage("signals", 1)
            bars = {symbol: columns.to_bars() for symbol, columns in waiting.items()}
            coded = run_python(spec.code, bars)
            for symbol, columns in waiting.items():
                codes = coded[symbol]
                enter = np.array([c == "enter" for c in codes], dtype=np.bool_)
                exit_ = np.array([c == "exit" for c in codes], dtype=np.bool_)
                scratch.add(symbol, columns, enter, exit_)
            progress.advance(1)
        return total

    def run(self, db: Session, run_id: str, progress: ProgressSink) -> None:
        run = db.get(BacktestRun, run_id)
        if run is None:
            raise EngineError(f"Backtest run {run_id} not found")
        spec = _spec(db, run)
        symbols = _symbols(db, run)
        start = _ist_midnight(run.date_from)
        end = _ist_midnight(run.date_to + timedelta(days=1))
        warm_up = timedelta(days=WARM_UP_DAYS.get(spec.timeframe, INTRADAY_WARM_UP_DAYS))
        limit = self.max_bars if isinstance(spec, StrategySpecVisual) else self.max_bars_python
        scratch = RunScratch(self.scratch_root, run.id)
        try:
            span = (start - warm_up, end)
            total = self._load(db, symbols, spec, span, limit, progress, scratch, start)
            self._simulate(db, run, spec, symbols, scratch, start, total, progress)
        finally:
            scratch.close()

    def _simulate(
        self,
        db: Session,
        run: BacktestRun,
        spec: StrategySpecVisual | StrategySpecPython,
        symbols: list[str],
        scratch: RunScratch,
        start: datetime,
        total: int,
        progress: ProgressSink,
    ) -> None:
        """Pass 2 (D61): all stocks in time order from the scratch folder; then the results."""
        rates: dict[date, ChargeRates] = {}

        def charges(qty: int, entry: int, exit_: int, entry_at: datetime) -> Charges:
            day = entry_at.astimezone(IST).date()
            if day not in rates:
                try:
                    rates[day] = rates_for(db, spec.segment, day)
                except LookupError as exc:
                    raise EngineError(str(exc)) from exc
            return trade_charges(rates[day], "buy", qty, entry, exit_)

        def on_bar(done: int, ts: datetime, trades: int) -> None:
            progress.advance(done, max(ts, start).astimezone(IST).date(), trades)

        progress.stage("simulating", total)
        result = simulate(
            scratch,
            spec.sizing,
            spec.risk,
            run.initial_capital_paise,
            start,
            charges,
            square_off=SQUARE_OFF if spec.segment == "equity_intraday" else None,
            averaging=spec.averaging,
            on_bar=on_bar,
        )
        summary = summarize(
            result.trades,
            result.equity,
            run.initial_capital_paise,
            run.date_from,
            run.date_to,
            symbols,
        )
        contract = ResultContract.model_validate(
            {
                "run_id": run.id,
                "metrics": summary.metrics,
                "equity_curve": [
                    {"date": day, "equity_paise": value, "benchmark_paise": None}
                    for day, value in result.equity
                ],
                "by_symbol": summary.by_symbol,
            }
        )
        wire = contract.model_dump(mode="json")

        progress.stage("saving", len(result.trades))
        db.execute(delete(Trade).where(Trade.run_id == run.id))
        db.execute(delete(BacktestResult).where(BacktestResult.run_id == run.id))
        for trade in result.trades:
            c = trade.charges
            db.add(
                Trade(
                    id=new_id("trd"),
                    run_id=run.id,
                    symbol=trade.symbol,
                    exchange="NSE",
                    segment=spec.segment,
                    side="buy",
                    qty=trade.qty,
                    entry_at=trade.entry_at,
                    entry_price_paise=trade.entry_price,
                    exit_at=trade.exit_at,
                    exit_price_paise=trade.exit_price,
                    gross_pnl_paise=trade.gross,
                    brokerage_paise=c.brokerage_paise,
                    stt_paise=c.stt_paise,
                    exchange_txn_paise=c.exchange_txn_paise,
                    sebi_fee_paise=c.sebi_fee_paise,
                    stamp_duty_paise=c.stamp_duty_paise,
                    gst_paise=c.gst_paise,
                    dp_paise=c.dp_paise,
                    charges_total_paise=c.total_paise,
                    net_pnl_paise=trade.net,
                )
            )
        m = summary.metrics
        db.add(
            BacktestResult(
                run_id=run.id,
                gross_pnl_paise=m["gross_pnl_paise"],
                charges_paise=m["charges_paise"],
                net_pnl_paise=m["net_pnl_paise"],
                return_percent=Decimal(str(m["return_percent"])),
                cagr_percent=Decimal(str(m["cagr_percent"])),
                max_drawdown_percent=Decimal(str(m["max_drawdown_percent"])),
                sharpe=Decimal(str(m["sharpe"])),
                win_rate_percent=Decimal(str(m["win_rate_percent"])),
                trade_count=m["trade_count"],
                win_count=m["win_count"],
                loss_count=m["loss_count"],
                equity_curve=wire["equityCurve"],
                by_symbol=wire["bySymbol"],
            )
        )
        run.status = "completed"
        run.finished_at = datetime.now(UTC)
        run.stage = "done"
        run.progress_percent = 100
        run.trades_so_far = len(result.trades)
        trim_older_versions(db, run)  # D60: older versions keep only their metrics
        db.commit()
