"""A run's progress on its `backtest_runs` row while the worker runs it (D58).

Each write is one UPDATE in its own session and commit: the engine's own transaction stays open
until the final commit, which sets `stage = 'done'` and 100%. Writes are throttled to one a
second, except on a stage change. A failed run keeps the last progress written.
"""

import time
from collections.abc import Callable
from datetime import date
from typing import Protocol

from nova_db.models import BacktestRun
from sqlalchemy import update
from sqlalchemy.orm import Session, sessionmaker

# Percent band of each stage: loading per stock, signals in one step, simulating per bar event.
BANDS = {"loading": (0, 20), "signals": (20, 30), "simulating": (30, 95), "saving": (95, 100)}
EVERY_SECONDS = 1.0


class ProgressSink(Protocol):
    def stage(self, name: str, total: int = 0) -> None:
        """Starts a stage; `total`: stocks (loading), steps (signals), bar events (simulating)."""

    def advance(
        self, done: int, simulated_to: date | None = None, trades: int | None = None
    ) -> None:
        """`done` of the stage's `total` are finished."""


class NullProgress:
    """Reports nothing (tests and callers without a database)."""

    def stage(self, name: str, total: int = 0) -> None:
        pass

    def advance(
        self, done: int, simulated_to: date | None = None, trades: int | None = None
    ) -> None:
        pass


class Progress:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        run_id: str,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._factory = session_factory
        self._run_id = run_id
        self._clock = clock
        self._stage = "loading"
        self._total = 0
        self._done = 0
        self._last_write: float | None = None
        self.values: dict[str, object] = {}

    def stage(self, name: str, total: int = 0) -> None:
        if name not in BANDS:
            raise ValueError(f"Unknown stage {name}")
        self._stage, self._total, self._done = name, total, 0
        if name == "loading":
            self.values = {
                "symbols_done": 0,
                "symbols_total": total,
                "bars_done": 0,
                "bars_total": 0,
                "trades_so_far": 0,
                "simulated_to": None,
            }
        elif name == "simulating":
            self.values |= {"bars_done": 0, "bars_total": total}
        self._write()

    def advance(
        self, done: int, simulated_to: date | None = None, trades: int | None = None
    ) -> None:
        self._done = min(done, self._total)
        if self._stage == "loading":
            self.values["symbols_done"] = self._done
        elif self._stage == "simulating":
            self.values["bars_done"] = self._done
        if simulated_to is not None:
            self.values["simulated_to"] = simulated_to
        if trades is not None:
            self.values["trades_so_far"] = trades
        last = self._last_write
        if last is None or self._clock() - last >= EVERY_SECONDS:
            self._write()

    @property
    def percent(self) -> int:
        low, high = BANDS[self._stage]
        share = self._done / self._total if self._total else 0
        return low + int((high - low) * share)

    def _write(self) -> None:
        self._last_write = self._clock()
        values = self.values | {"stage": self._stage, "progress_percent": self.percent}
        with self._factory() as db:
            db.execute(update(BacktestRun).where(BacktestRun.id == self._run_id).values(values))
            db.commit()
