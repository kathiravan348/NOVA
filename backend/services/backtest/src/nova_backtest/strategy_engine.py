"""Backtest engine (D45–D47, D61, D62): visual, Python and rotation strategies.

Pass 1 goes stock by stock: bars → signals (or rotation scores) → the scratch folder. Pass 2
simulates every stock in time order from there; `save.py` then writes the results.
"""

from collections.abc import Callable
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

import numpy as np
from nova_contracts import Charges, StrategySpec, StrategySpecIntraday
from nova_contracts.strategy import (
    OperandIndicator,
    Risk,
    StrategySpecPython,
    StrategySpecRotation,
    StrategySpecVisual,
    spec_operands,
)
from nova_db.models import BacktestRun, Instrument, StrategyVersion
from nova_ledger import ChargeRates, rates_for, trade_charges
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from nova_backtest.bars import IST
from nova_backtest.columns import Columns, load_recorded
from nova_backtest.columns import load as load_columns
from nova_backtest.engine import EngineError
from nova_backtest.indicators import indicator_array, settings_for
from nova_backtest.progress import ProgressSink
from nova_backtest.quotes import QuoteBook, TickQuotes
from nova_backtest.regime import RegimeSeries, load_regime
from nova_backtest.rotation import rotation_arrays, simulate_rotation
from nova_backtest.rules import SeriesCache, check_group
from nova_backtest.rules import signals as rule_signals
from nova_backtest.sandbox import ENTER, EXIT, Calls, check_code, run_python_one
from nova_backtest.save import save_result
from nova_backtest.scratch import Bools, Floats, RunScratch
from nova_backtest.simulate import Simulation, simulate
from nova_backtest.tick_bars import read_quotes, timeframe_seconds, usable_days

SPEC = TypeAdapter[StrategySpec](StrategySpec)
Spec = StrategySpecVisual | StrategySpecPython | StrategySpecRotation
WARM_UP_DAYS = {"1d": 400, "1s": 1, "5s": 1, "15s": 1, "30s": 1}  # seconds: D82
# Zerodha squares off MIS equity positions from 15:20 IST (D46).
SQUARE_OFF = time(15, 20)
INTRADAY_WARM_UP_DAYS = 30
DEFAULT_SCRATCH = Path("/tmp/nova-backtest")  # noqa: S108 - the worker container's own disk (D61)


def _spec(db: Session, run: BacktestRun) -> Spec:
    version = db.get(StrategyVersion, (run.strategy_id, run.strategy_version))
    if version is None:
        raise EngineError("The strategy version of this run no longer exists")
    try:
        spec = SPEC.validate_python(version.spec)
    except ValidationError as exc:
        raise EngineError("The stored strategy spec is not valid") from exc
    for operand in spec_operands(spec):
        if isinstance(operand, OperandIndicator):
            try:
                settings_for(operand.name, operand.params)
            except ValueError as exc:
                raise EngineError(f"{exc}: open the strategy and save it again") from exc
    if isinstance(spec, StrategySpecIntraday):
        raise EngineError("Intraday setups run on the intraday simulator, which is not built yet")
    if isinstance(spec, StrategySpecRotation):
        return spec  # the contract allows only equity delivery on 1d (D62 (4))
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


def _atr(risk: Risk, columns: Columns) -> Floats | None:
    """ATR for the ATR stop (D62), when the spec has one."""
    if risk.atr_stop is None:
        return None
    return indicator_array("atr", {"period": float(risk.atr_stop.period)}, columns)


def _signals(
    spec: Spec, symbol: str, columns: Columns, calls: Calls
) -> tuple[Bools, Bools, Floats | None]:
    """One stock's `enter`, `exit` and rank arrays. Rotation: passes the filter, never, score."""
    if isinstance(spec, StrategySpecRotation):
        score, eligible = rotation_arrays(columns, spec.rotation)
        return eligible, np.zeros(len(columns), dtype=np.bool_), score
    if isinstance(spec, StrategySpecVisual):
        enter, exit_ = rule_signals(columns, spec.entry, spec.exit)
    else:
        codes = run_python_one(spec.code, symbol, columns, calls)
        enter, exit_ = codes == ENTER, codes == EXIT
    portfolio = spec.portfolio
    rank = None
    if portfolio is not None and portfolio.rank is not None:
        rank = SeriesCache(columns).values(portfolio.rank.by)
    return enter, exit_, rank


def _ist_midnight(day: date) -> datetime:
    return datetime.combine(day, time(0, 0), tzinfo=IST).astimezone(UTC)


class StrategyEngine:
    def __init__(
        self,
        max_bars: int = 50_000_000,
        max_bars_python: int = 5_000_000,
        scratch_root: Path = DEFAULT_SCRATCH,
        archive_root: Path = Path("archive"),
    ) -> None:
        self.scratch_root = scratch_root
        self.archive_root = archive_root  # the Parquet tick archive (D49), for recorded runs
        self.max_bars = max_bars
        self.max_bars_python = max_bars_python

    def _load(
        self,
        db: Session,
        symbols: list[str],
        spec: Spec,
        loader: Callable[[str], Columns],
        limit: int,
        progress: ProgressSink,
        scratch: RunScratch,
        start: datetime,
        regime: RegimeSeries | None,
    ) -> tuple[int, list[str], list[str]]:
        """Pass 1 (D61): one stock at a time, its columns and signals go to `scratch`.

        Signals are computed right after each stock loads (visual rules on arrays, Python code in
        its own sandbox process, rotation scores), so only one stock's arrays exist at a time.
        Stops as soon as the run passes the bar limit (D59, D61 (6)); 3m–1h are rolled up from
        1m (D58). Answers the bar count, loaded symbols and missing symbols.
        """
        progress.stage("loading", len(symbols))
        calls: Calls = {}
        if isinstance(spec, StrategySpecVisual):
            check_group(spec.entry)
            check_group(spec.exit)
        elif isinstance(spec, StrategySpecPython):
            calls = check_code(spec.code)  # once per run, not per stock
            progress.stage("signals", len(symbols))
        missing: list[str] = []
        loaded: list[str] = []
        first, total, stored = int(start.timestamp()), 0, 0
        for done, symbol in enumerate(symbols, start=1):
            columns = loader(symbol)
            total += len(columns)
            if total > limit:
                raise EngineError(
                    f"This run needs more than {limit:,} price bars (stopped at {symbol}). "
                    "Pick fewer stocks or a shorter period."
                )
            if len(columns) == 0 or int(columns.ts[-1]) < first:
                missing.append(symbol)
            else:
                enter, exit_, rank = _signals(spec, symbol, columns, calls)
                market = None if regime is None else regime.at(columns.ts)
                scratch.add(symbol, columns, enter, exit_, rank, _atr(spec.risk, columns), market)
                loaded.append(symbol)
                stored += len(columns)
            del columns
            progress.advance(done)
        return stored, loaded, missing

    def run(self, db: Session, run_id: str, progress: ProgressSink) -> None:
        run = db.get(BacktestRun, run_id)
        if run is None:
            raise EngineError(f"Backtest run {run_id} not found")
        spec = _spec(db, run)
        symbols = _symbols(db, run)
        start = _ist_midnight(run.date_from)
        end = _ist_midnight(run.date_to + timedelta(days=1))
        warm_up = timedelta(days=WARM_UP_DAYS.get(spec.timeframe, INTRADAY_WARM_UP_DAYS))
        span = (start - warm_up, end)
        python = isinstance(spec, StrategySpecPython)
        limit = self.max_bars_python if python else self.max_bars
        regime = None
        if spec.regime is not None:
            regime = load_regime(db, spec.regime, spec.timeframe, span, start)
        recorded = run.data_source == "recorded"
        recorded_days: tuple[int, list[date]] | None = None
        scratch = RunScratch(self.scratch_root, run.id)
        quotes: QuoteBook | None = None
        if recorded:
            if spec.segment != "equity_intraday":  # the API refuses these too (D82)
                raise EngineError("Recorded data backtests are intraday only")
            quotes = QuoteBook(scratch.path / "quotes", timeframe_seconds(spec.timeframe))
            loader, recorded_days = self._recorded_loader(db, run, spec, symbols, span, quotes)
        else:

            def loader(symbol: str) -> Columns:
                return load_columns(db, "NSE", symbol, spec.timeframe, *span)

        try:
            total, loaded, missing = self._load(
                db, symbols, spec, loader, limit, progress, scratch, start, regime
            )
            if run.universe["type"] == "symbols" and missing:
                raise EngineError(
                    f"No recorded ticks in the period for {', '.join(missing)}"
                    if recorded
                    else f"No {spec.timeframe} candles in the period for {', '.join(missing)} "
                    "(download them first)"
                )
            if not loaded:
                raise EngineError(
                    f"No stock in {run.universe['index']} has recorded ticks in the period"
                    if recorded
                    else f"No stock in {run.universe['index']} has {spec.timeframe} prices "
                    "in the period (download them first)"
                )
            result = self._simulate(db, run, spec, scratch, start, total, progress, quotes)
            period = (start, end)
            save_result(
                db,
                run,
                spec.segment,
                loaded,
                sorted(missing),
                result,
                period,
                progress,
                recorded_days,
            )
        finally:
            if quotes is not None:
                quotes.close()
            scratch.close()

    def _recorded_loader(
        self,
        db: Session,
        run: BacktestRun,
        spec: Spec,
        symbols: list[str],
        span: tuple[datetime, datetime],
        quotes: QuoteBook,
    ) -> tuple[Callable[[str], Columns], tuple[int, list[date]]]:
        """Usable recorded days (D82 (4)): warm-up days before `from` count, only period days
        are reported. The counts are saved with the result: changing the run row now would make
        the progress writer wait for this transaction (NOVA-137)."""
        first = span[0].astimezone(IST).date()
        days = usable_days(db, "NSE", symbols, first, run.date_to)
        used = [d for d in days.sessions if d >= run.date_from]
        if not used:
            raise EngineError("No usable recorded days in this period")
        skipped = [d for d in days.skipped if d >= run.date_from]
        root = self.archive_root

        def loader(symbol: str) -> Columns:
            stock_days = days.by_symbol.get(symbol, [])
            if stock_days:  # D82 (5): the ticks' quotes, for bid/ask fills in pass 2
                parts = [read_quotes(db, root, "NSE", symbol, day) for day in stock_days]
                quotes.add(symbol, TickQuotes.joined(parts))
            return load_recorded(db, root, "NSE", symbol, spec.timeframe, stock_days)

        return loader, (len(used), skipped)

    def _simulate(
        self,
        db: Session,
        run: BacktestRun,
        spec: Spec,
        scratch: RunScratch,
        start: datetime,
        total: int,
        progress: ProgressSink,
        quotes: QuoteBook | None = None,
    ) -> Simulation:
        """Pass 2 (D61): all stocks in time order from the scratch folder."""
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
        cash = run.initial_capital_paise
        when_off = None if spec.regime is None else spec.regime.when_off
        if isinstance(spec, StrategySpecRotation):
            return simulate_rotation(
                scratch, spec.rotation, spec.risk, cash, start, charges, when_off, on_bar
            )
        return simulate(
            scratch,
            spec.sizing,
            spec.risk,
            cash,
            start,
            charges,
            square_off=SQUARE_OFF if spec.segment == "equity_intraday" else None,
            averaging=spec.averaging,
            on_bar=on_bar,
            portfolio=spec.portfolio,
            when_off=when_off,
            fills=quotes,
        )
