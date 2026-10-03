"""`python -m nova_atlas worker`: the data-job worker (Compose `atlas-worker`).

Syncing instruments, downloads and tick archives are started from Relay (D54, D55).
"""

import argparse
import logging
import signal
import threading
from datetime import UTC, datetime

from nova_db import create_db_engine, create_session_factory

from nova_atlas.broker_client import BrokerData
from nova_atlas.live_check import DailyCheck
from nova_atlas.live_summary import summarize_next
from nova_atlas.settings import get_atlas_settings
from nova_atlas.sync_job import maybe_queue_daily_sync
from nova_atlas.worker import run_worker


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_atlas")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("worker", help="run data jobs until stopped")
    parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")

    settings = get_atlas_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    broker = BrokerData(settings.broker_url, settings.internal_token.get_secret_value())
    daily_check = DailyCheck(broker)
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    try:
        run_worker(
            create_session_factory(engine),
            broker,
            stop,
            settings.worker_poll_seconds,
            archive_dir=settings.archive_dir,
            schedule=maybe_queue_daily_sync,
            summarize=lambda db: summarize_next(db, settings.archive_dir, datetime.now(UTC)),
            check=lambda db: daily_check.check_next(db, datetime.now(UTC)),
        )
    finally:
        engine.dispose()
    return 0
