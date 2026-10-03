"""`IntradayEngine`: runs a queued `mode: "intraday"` backtest on recorded ticks (D84).

One usable session at a time (§7): each stock's ticks of that day are read into the run's scratch
folder, 1m and 5m bars are built from them, the day is replayed (`replay.py`), and the folder is
removed before the next day, so memory stays flat however long the period. Cash carries from day to
day; equity is the cash after each session (nothing is held overnight). Results go through the
shared writer (trades, metrics, equity), plus one `intraday_trades` row per trade.
"""

import shutil
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

from nova_contracts import Charges, ResearchSettings, StrategySpecIntraday
from nova_db.models import BacktestRun, Instrument, IntradayTrade, StrategyVersion
from nova_ledger import ChargeRates, rates_for, trade_charges
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from nova_backtest.bars import IST
from nova_backtest.engine import EngineError
from nova_backtest.intraday.fills import DepthAt, Execution
from nova_backtest.intraday.position import Position
from nova_backtest.intraday.replay import DayReplay, Timing
from nova_backtest.intraday.setups import SetupFactory, StockDay, factory_for
from nova_backtest.intraday.tick_data import (
    MINUTE_MS,
    Sessions,
    TickSource,
    build_bars,
    tick_sizes,
    usable_sessions,
)
from nova_backtest.profiles import get_frozen_settings
from nova_backtest.progress import ProgressSink
from nova_backtest.save import save_result
from nova_backtest.scratch import RunScratch
from nova_backtest.simulate import Simulation
from nova_backtest.strategy_engine import DEFAULT_SCRATCH

SEGMENT = "equity_intraday"
# Until NOVA-186 sizes by risk, every entry asks for this many shares.
TEST_QTY = 1


def execution_for(settings: ResearchSettings, scenario: str | None) -> Execution:
    """The fill settings of a scenario: `stress` takes the stress delay and slippage (D84 (3))."""
    e = settings.execution
    stress = scenario == "stress"
    return Execution(
        delay_ms=e.stress_delay_ms if stress else e.delay_ms,
        slippage_ticks=e.stress_slippage_ticks if stress else e.slippage_ticks,
        max_quote_age_ms=e.max_quote_age_ms,
        max_spread_bps=e.max_spread_bps,
        max_spread_to_stop_percent=e.max_spread_to_stop_percent,
        max_depth_percent=e.max_depth_percent,
        min_fill_percent=e.min_fill_percent,
    )


def timing_for(settings: ResearchSettings, day: date) -> Timing:
    t = settings.timing
    return Timing.of(day, t.earliest_entry, t.last_entry, t.square_off, t.max_hold_minutes)


def intraday_spec(db: Session, run: BacktestRun) -> StrategySpecIntraday:
    version = db.get(StrategyVersion, (run.strategy_id, run.strategy_version))
    if version is None:
        raise EngineError("The strategy version of this run no longer exists")
    try:
        return StrategySpecIntraday.model_validate(version.spec)
    except ValidationError as exc:
        raise EngineError("The stored intraday strategy is not valid") from exc


def run_symbols(db: Session, run: BacktestRun) -> list[str]:
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


class OrderCosts:
    """Charges of one order (NOVA Ledger, intraday rates of its IST day), by order value."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._rates: dict[date, ChargeRates] = {}

    def rates(self, day: date) -> ChargeRates:
        if day not in self._rates:
            try:
                self._rates[day] = rates_for(self.db, SEGMENT, day)
            except LookupError as exc:
                raise EngineError(str(exc)) from exc
        return self._rates[day]

    def __call__(self, side: str, value: int, at_ms: int) -> Charges:
        day = datetime.fromtimestamp(at_ms / 1000, UTC).astimezone(IST).date()
        # One share at the order's value: every charge depends only on value and order count.
        return trade_charges(self.rates(day), "buy" if side == "buy" else "sell", 1, value, None)


class IntradayEngine:
    def __init__(self, scratch_root: Path = DEFAULT_SCRATCH, archive_root: Path = Path("archive")):
        self.scratch_root, self.archive_root = scratch_root, archive_root

    def run(self, db: Session, run_id: str, progress: ProgressSink) -> None:
        run = db.get(BacktestRun, run_id)
        if run is None:
            raise EngineError(f"Backtest run {run_id} not found")
        spec = intraday_spec(db, run)
        if run.data_source != "recorded":
            raise EngineError("Intraday strategies run on recorded data")
        if run.profile_id is None or run.profile_version is None:
            raise EngineError("An intraday run needs a research profile version")
        settings = get_frozen_settings(db, run.profile_id, run.profile_version)
        factory = factory_for(spec.setup)
        symbols = run_symbols(db, run)
        sessions = usable_sessions(
            db, symbols, run.date_from, run.date_to, settings.data.max_session_gap_seconds
        )
        if not sessions.days:
            raise EngineError("No usable recorded days in this period")
        sizes, missing_sizes = tick_sizes(db, symbols)
        scratch = RunScratch(self.scratch_root, run.id)
        try:
            positions, equity, loaded = self._replay(
                db, run, spec, settings, sessions, symbols, sizes, factory, scratch, progress
            )
        finally:
            scratch.close()
        missing = sorted(set(symbols) - loaded)
        if run.universe["type"] == "symbols" and missing:
            raise EngineError(f"No recorded ticks in the period for {', '.join(missing)}")
        if not loaded:
            raise EngineError(
                f"No stock in {run.universe['index']} has recorded ticks in the period"
            )
        positions.sort(key=lambda p: (p.buys[0].at_ms, p.symbol))
        result = Simulation([p.trade() for p in positions], equity)
        inputs = [f"tick_size:{s}" for s in missing_sizes if s in loaded]

        def with_trades(ids: list[str]) -> None:
            for trade_id, position in zip(ids, positions, strict=True):
                db.add(
                    IntradayTrade(
                        trade_id=trade_id,
                        stop_paise=position.stop,
                        target_paise=position.target,
                        first_fill_paise=position.first_fill,
                        risk_paise=position.risk,
                        legs=position.legs(),
                        unresolved=position.unresolved,
                    )
                )
            run.incomplete = any(p.unresolved for p in positions)
            run.history_inputs = inputs

        start = datetime.combine(run.date_from, time(0, 0), IST).astimezone(UTC)
        end = datetime.combine(run.date_to + timedelta(days=1), time(0, 0), IST).astimezone(UTC)
        save_result(
            db,
            run,
            SEGMENT,
            sorted(loaded),
            missing,
            result,
            (start, end),
            progress,
            (len(sessions.days), sessions.skipped),
            with_trades,
        )

    def _replay(
        self,
        db: Session,
        run: BacktestRun,
        spec: StrategySpecIntraday,
        settings: ResearchSettings,
        sessions: Sessions,
        symbols: list[str],
        sizes: dict[str, int],
        make: SetupFactory,
        scratch: RunScratch,
        progress: ProgressSink,
    ) -> tuple[list[Position], list[tuple[date, int]], set[str]]:
        execution = execution_for(settings, run.scenario)
        costs = OrderCosts(db)
        cash = run.initial_capital_paise
        positions: list[Position] = []
        equity: list[tuple[date, int]] = []
        loaded: set[str] = set()
        total = sum(len(days) for days in sessions.by_symbol.values())
        progress.stage("simulating", total)
        done = 0
        for day in sessions.days:
            folder = scratch.path / day.isoformat()
            source = TickSource(db, self.archive_root, folder)
            stocks: dict[str, StockDay] = {}
            for symbol in symbols:
                if day not in sessions.by_symbol.get(symbol, []):
                    continue
                ticks = source.load(symbol, day)
                done += 1
                if len(ticks):
                    bars1, bars5 = build_bars(ticks, MINUTE_MS), build_bars(ticks, 5 * MINUTE_MS)
                    stocks[symbol] = StockDay(symbol, day, ticks, bars1, bars5)
                    loaded.add(symbol)
            replay = DayReplay(
                stocks,
                {s: make(spec.setup, stock) for s, stock in stocks.items()},
                execution,
                timing_for(settings, day),
                sizes,
                DepthAt(source.depth),
                costs,
                lambda _candidate: TEST_QTY,
            )
            replay.run()
            for position in replay.closed:
                cash += position.trade().net
            positions.extend(replay.closed)
            equity.append((day, cash))
            progress.advance(done, day, len(positions))
            shutil.rmtree(folder, ignore_errors=True)
        return positions, equity, loaded
