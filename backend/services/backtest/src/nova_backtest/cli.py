"""`python -m nova_backtest worker`: runs queued backtests until stopped."""

import argparse
import logging
import signal
import threading

from nova_db import create_db_engine, create_session_factory

from nova_backtest.engine import BacktestEngine
from nova_backtest.settings import get_backtest_settings
from nova_backtest.visual import VisualEngine
from nova_backtest.worker import run_worker


def default_engine() -> BacktestEngine:
    return VisualEngine()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_backtest")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("worker", help="run queued backtests until stopped")
    parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")

    settings = get_backtest_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    try:
        run_worker(
            create_session_factory(engine), default_engine(), stop, settings.worker_poll_seconds
        )
    finally:
        engine.dispose()
    return 0
