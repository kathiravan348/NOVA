import threading
from datetime import date

from nova_backtest.engine import BacktestEngine, EngineError, PendingEngine
from nova_backtest.worker import run_worker
from nova_db.models import BacktestRun
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session, sessionmaker


def _queue(engine: Engine, count: int) -> list[str]:
    ids = [f"run_{i}" for i in range(count)]
    with Session(engine) as db:
        for run_id in ids:
            db.add(
                BacktestRun(
                    id=run_id,
                    strategy_id="stg_1",
                    strategy_version=1,
                    name=run_id,
                    universe={"type": "symbols", "symbols": ["INFY"]},
                    status="queued",
                    date_from=date(2025, 1, 1),
                    date_to=date(2025, 6, 30),
                    initial_capital_paise=10_000_000,
                    benchmark=None,
                )
            )
            db.commit()
    return ids


def _drain(factory: sessionmaker[Session], engine: BacktestEngine) -> None:
    stop = threading.Event()
    run_worker(factory, engine, stop, poll_seconds=0, on_idle=stop.set)


def _runs(engine: Engine) -> list[BacktestRun]:
    with Session(engine) as db:
        return list(
            db.scalars(select(BacktestRun).order_by(BacktestRun.created_at, BacktestRun.id))
        )


def test_pending_engine_fails_runs_with_a_clear_message(
    clean: Engine, factory: sessionmaker[Session]
) -> None:
    _queue(clean, 2)

    _drain(factory, PendingEngine())

    runs = _runs(clean)
    assert [r.status for r in runs] == ["failed", "failed"]
    assert runs[0].error == "Backtest engine arrives in NOVA-062"
    assert runs[0].started_at is not None and runs[0].finished_at is not None


class CompletingEngine:
    def run(self, db: Session, run_id: str) -> None:
        run = db.get(BacktestRun, run_id)
        assert run is not None
        run.status = "completed"
        db.commit()


class CrashingEngine:
    def run(self, db: Session, run_id: str) -> None:
        raise RuntimeError("secret detail")


class RefusingEngine:
    def run(self, db: Session, run_id: str) -> None:
        raise EngineError("No candles for INFY")


def test_engine_outcomes(clean: Engine, factory: sessionmaker[Session]) -> None:
    _queue(clean, 1)
    _drain(factory, CompletingEngine())
    assert _runs(clean)[0].status == "completed"


def test_engine_errors_fail_only_that_run(clean: Engine, factory: sessionmaker[Session]) -> None:
    _queue(clean, 1)
    _drain(factory, RefusingEngine())
    assert _runs(clean)[0].error == "No candles for INFY"


def test_crashes_hide_details(clean: Engine, factory: sessionmaker[Session]) -> None:
    _queue(clean, 1)
    _drain(factory, CrashingEngine())
    run = _runs(clean)[0]
    assert run.status == "failed" and run.error == "Unexpected error; see the worker log"
