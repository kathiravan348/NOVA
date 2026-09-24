"""The engine the worker hands each claimed run to (D44). The real engine is NOVA-062."""

from typing import Protocol

from sqlalchemy.orm import Session


class EngineError(Exception):
    """The run cannot be completed; the message is shown on the run (keep it short and plain)."""


class BacktestEngine(Protocol):
    def run(self, db: Session, run_id: str) -> None:
        """Completes the run: writes trades and result and marks it `completed`, in one commit."""


class PendingEngine:
    """Placeholder until NOVA-062: every run fails with a clear message."""

    def run(self, db: Session, run_id: str) -> None:
        raise EngineError("Backtest engine arrives in NOVA-062")
