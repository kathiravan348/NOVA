"""`python -m nova_broker new-token-key | recorder`.

Accounts, Kite keys and tick recording are managed from Relay (D54, D55).
"""

import argparse
import logging
import signal
import threading

from nova_db import create_db_engine, create_session_factory
from sqlalchemy.orm import Session, sessionmaker

from nova_broker.crypto import TokenCipher, new_key
from nova_broker.recorder_loop import RecorderLoop
from nova_broker.settings import BrokerSettings, get_broker_settings


def _stop_on_signals() -> threading.Event:
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    return stop


def run_recorder(settings: BrokerSettings, factory: sessionmaker[Session]) -> None:
    """The always-on recorder (D54): follows Relay's switch until SIGTERM."""
    token_key = settings.broker_token_key
    cipher = TokenCipher(token_key.get_secret_value()) if token_key else None
    if cipher is None:
        logging.getLogger("nova.broker").warning(
            "NOVA_BROKER_TOKEN_KEY is not set: the recorder only waits"
        )
    RecorderLoop(factory=factory, cipher=cipher, stop=_stop_on_signals()).run()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_broker")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("new-token-key", help="print a new NOVA_BROKER_TOKEN_KEY")
    commands.add_parser("recorder", help="always-on recorder that follows Relay's switch")
    args = parser.parse_args(argv)

    if args.command == "new-token-key":
        print(new_key())
        return 0

    settings = get_broker_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")
    try:
        run_recorder(settings, create_session_factory(engine))
    finally:
        engine.dispose()
    return 0
