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
from nova_backtest.intraday.decisions import DecisionLog
from nova_backtest.intraday.fills import DepthAt, Execution
from nova_backtest.intraday.guard import Guard
from nova_backtest.intraday.position import Position
from nova_backtest.intraday.replay import DayReplay, Timing
from nova_backtest.intraday.setups import SetupFactory, StockDay, factory_for
from nova_backtest.intraday.sizing import CostToClose
from nova_backtest.intraday.tick_data import (
    MINUTE_MS,
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
        return self.on_day(side, value, day)

    def on_day(self, side: str, value: int, day: date) -> Charges:
        # One share at the order's value: every charge depends only on value and order count.
        return trade_charges(self.rates(day), "buy" if side == "buy" else "sell", 1, value, None)

    def to_close(self, day: date) -> CostToClose:
        """Sizing costs of a day: charges of the buy plus the sell at the stop (by value)."""

        def costs(bought: int, sold: int) -> int:
            buy = self.on_day("buy", bought, day).total_paise
            return buy + self.on_day("sell", sold, day).total_paise

        return costs


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
        _Run(db, run, spec, settings, self.archive_root).execute(self.scratch_root, progress)


class _Run:
    """One intraday run from its first usable session to the saved result."""

    def __init__(
        self,
        db: Session,
        run: BacktestRun,
        spec: StrategySpecIntraday,
        settings: ResearchSettings,
        archive_root: Path,
    ) -> None:
        self.db, self.run, self.spec, self.settings = db, run, spec, settings
        self.archive_root = archive_root
        self.make: SetupFactory = factory_for(spec.setup)
        self.symbols = run_symbols(db, run)
        self.sessions = usable_sessions(
            db, self.symbols, run.date_from, run.date_to, settings.data.max_session_gap_seconds
        )
        if not self.sessions.days:
            raise EngineError("No usable recorded days in this period")
        self.sizes, self.missing_sizes = tick_sizes(db, self.symbols)
        self.execution = execution_for(settings, run.scenario)
        self.costs = OrderCosts(db)
        rows = db.execute(
            select(Instrument.symbol, Instrument.sector).where(
                Instrument.exchange == "NSE", Instrument.symbol.in_(self.symbols)
            )
        )
        sectors = {symbol: sector or "" for symbol, sector in rows}
        self.guard = Guard(
            settings.account, run.initial_capital_paise, sectors, self.costs.to_close(run.date_from)
        )
        self.log = DecisionLog(db, run.id)
        self.positions: list[Position] = []
        self.equity: list[tuple[date, int]] = []
        self.loaded: set[str] = set()
        self.history_inputs: list[str] = []

    def execute(self, scratch_root: Path, progress: ProgressSink) -> None:
        run = self.run
        scratch = RunScratch(scratch_root, run.id)
        try:
            self._days(scratch, progress)
        finally:
            scratch.close()
        missing = sorted(set(self.symbols) - self.loaded)
        if run.universe["type"] == "symbols" and missing:
            raise EngineError(f"No recorded ticks in the period for {', '.join(missing)}")
        if not self.loaded:
            index = run.universe["index"]
            raise EngineError(f"No stock in {index} has recorded ticks in the period")
        positions = sorted(self.positions, key=lambda p: (p.buys[0].at_ms, p.symbol))
        result = Simulation([p.trade() for p in positions], self.equity)
        inputs = [f"tick_size:{s}" for s in self.missing_sizes if s in self.loaded]

        def with_trades(ids: list[str]) -> None:
            self.log.link({id(p): trade_id for trade_id, p in zip(ids, positions, strict=True)})
            for trade_id, position in zip(ids, positions, strict=True):
                self.db.add(
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
            run.history_inputs = list(dict.fromkeys(inputs + self.history_inputs))

        start = datetime.combine(run.date_from, time(0, 0), IST).astimezone(UTC)
        end = datetime.combine(run.date_to + timedelta(days=1), time(0, 0), IST).astimezone(UTC)
        save_result(
            self.db,
            run,
            SEGMENT,
            sorted(self.loaded),
            missing,
            result,
            (start, end),
            progress,
            (len(self.sessions.days), self.sessions.skipped),
            with_trades,
        )

    def _days(self, scratch: RunScratch, progress: ProgressSink) -> None:
        total = sum(len(days) for days in self.sessions.by_symbol.values())
        progress.stage("simulating", total)
        done = 0
        for day in self.sessions.days:
            folder = scratch.path / day.isoformat()
            source = TickSource(self.db, self.archive_root, folder)
            stocks: dict[str, StockDay] = {}
            for symbol in self.symbols:
                if day not in self.sessions.by_symbol.get(symbol, []):
                    continue
                ticks = source.load(symbol, day)
                done += 1
                if len(ticks):
                    bars1, bars5 = build_bars(ticks, MINUTE_MS), build_bars(ticks, 5 * MINUTE_MS)
                    stocks[symbol] = StockDay(symbol, day, ticks, bars1, bars5)
                    self.loaded.add(symbol)
            self._day(day, stocks, source)
            progress.advance(done, day, len(self.positions))
            shutil.rmtree(folder, ignore_errors=True)

    def _day(self, day: date, stocks: dict[str, StockDay], source: TickSource) -> None:
        self.guard.costs = self.costs.to_close(day)
        replay = DayReplay(
            stocks,
            {s: self.make(self.spec.setup, stock) for s, stock in stocks.items()},
            self.execution,
            timing_for(self.settings, day),
            self.sizes,
            DepthAt(source.depth),
            self.costs,
            self.guard,
        )
        replay.run()
        self.log.write(replay.decisions)
        self.positions.extend(replay.closed)
        self.equity.append((day, self.guard.cash))
