"""Progress writes: own session, throttled to one a second, always on a stage change (D58)."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date
from typing import Any

from nova_backtest.progress import Progress
from nova_db.models import BacktestRun
from sqlalchemy import Engine, event
from sqlalchemy.orm import Session, sessionmaker


class FakeClock:
    def __init__(self) -> None:
        self.now = 100.0

    def __call__(self) -> float:
        return self.now


@contextmanager
def _updates(engine: Engine) -> Iterator[list[str]]:
    seen: list[str] = []

    def before(conn: Any, cursor: Any, statement: str, *_: Any) -> None:  # Any: DBAPI hook
        if statement.startswith("UPDATE backtest_runs"):
            seen.append(statement)

    event.listen(engine, "before_cursor_execute", before)
    try:
        yield seen
    finally:
        event.remove(engine, "before_cursor_execute", before)


def _queue(engine: Engine) -> str:
    with Session(engine) as db:
        db.add(
            BacktestRun(
                id="run_p",
                strategy_id="stg_1",
                strategy_version=1,
                name="Progress",
                universe={"type": "symbols", "symbols": ["INFY"]},
                status="running",
                date_from=date(2025, 1, 1),
                date_to=date(2025, 6, 30),
                initial_capital_paise=10_000_000,
                benchmark=None,
            )
        )
        db.commit()
    return "run_p"


def test_many_advances_within_a_second_write_once(
    clean: Engine, factory: sessionmaker[Session]
) -> None:
    clock = FakeClock()
    progress = Progress(factory, _queue(clean), clock)
    progress.stage("simulating", 20_000)
    clock.now += 1.0

    with _updates(clean) as updates:
        for done in range(1, 10_001):
            progress.advance(done)
        clock.now += 0.5

    assert len(updates) == 1


def test_a_stage_change_always_writes(clean: Engine, factory: sessionmaker[Session]) -> None:
    progress = Progress(factory, _queue(clean), FakeClock())

    with _updates(clean) as updates:
        progress.stage("loading", 2)
        progress.stage("signals", 1)
        progress.stage("simulating", 10)

    assert len(updates) == 3


def test_percent_follows_the_stage_bands(clean: Engine, factory: sessionmaker[Session]) -> None:
    run_id = _queue(clean)
    clock = FakeClock()
    progress = Progress(factory, run_id, clock)

    progress.stage("loading", 4)
    progress.advance(2)
    assert progress.percent == 10
    progress.stage("signals", 1)
    assert progress.percent == 20
    progress.stage("simulating", 1_000)
    clock.now += 5
    progress.advance(500, date(2025, 3, 14), 3)
    assert progress.percent == 62
    progress.stage("saving", 3)

    with factory() as db:
        run = db.get(BacktestRun, run_id)
        assert run is not None
        assert (run.stage, run.progress_percent) == ("saving", 95)
        assert (run.symbols_done, run.symbols_total, run.bars_done, run.bars_total) == (
            2,
            4,
            500,
            1_000,
        )
        assert (run.trades_so_far, run.simulated_to) == (3, date(2025, 3, 14))
