"""Sends each claimed run to the simulator its strategy needs (D84 (1)): `mode: "intraday"` → the
intraday simulator, every other mode → the candle simulator (unchanged)."""

from nova_db.models import BacktestRun, StrategyVersion
from sqlalchemy.orm import Session

from nova_backtest.engine import BacktestEngine, EngineError
from nova_backtest.progress import ProgressSink


class DispatchEngine:
    def __init__(self, candle: BacktestEngine, intraday: BacktestEngine) -> None:
        self.candle, self.intraday = candle, intraday

    def run(self, db: Session, run_id: str, progress: ProgressSink) -> None:
        run = db.get(BacktestRun, run_id)
        if run is None:
            raise EngineError(f"Backtest run {run_id} not found")
        version = db.get(StrategyVersion, (run.strategy_id, run.strategy_version))
        intraday = version is not None and version.spec.get("mode") == "intraday"
        (self.intraday if intraday else self.candle).run(db, run_id, progress)
