"""`python -m nova_atlas worker`: the data-job worker (Compose `atlas-worker`).

Syncing instruments, downloads and tick archives are started from Relay (D54, D55).
"""

import argparse
import logging
import signal
import threading

from nova_db import create_db_engine, create_session_factory

from nova_atlas.broker_client import BrokerData
from nova_atlas.settings import get_atlas_settings
from nova_atlas.worker import run_worker


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_atlas")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("worker", help="run data jobs until stopped")
    parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")

    settings = get_atlas_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    try:
        run_worker(
            create_session_factory(engine),
            BrokerData(settings.broker_url, settings.internal_token.get_secret_value()),
            stop,
            settings.worker_poll_seconds,
            archive_dir=settings.archive_dir,
        )
    finally:
        engine.dispose()
    return 0
