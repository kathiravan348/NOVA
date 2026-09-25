"""`python -m nova_broker add-account | new-token-key | record-ticks | recorder`."""

import argparse
import asyncio
import logging
import signal
import sys
import threading
from datetime import UTC, datetime
from typing import Any

from nova_common import ApiException
from nova_db import create_db_engine, create_session_factory
from nova_db.models import Tick
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker
from websockets.asyncio.client import connect

from nova_broker.accounts import add_account
from nova_broker.crypto import TokenCipher, new_key
from nova_broker.internal import active_session
from nova_broker.recorder import Recorder, kite_url
from nova_broker.recorder_loop import IST, MARKET_CLOSE, RecorderLoop, tick_symbols
from nova_broker.settings import BrokerSettings, get_broker_settings


def _stop_on_signals() -> threading.Event:
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    return stop


def record_ticks(
    settings: BrokerSettings, factory: sessionmaker[Session], symbols: list[str]
) -> None:
    """Records now, until 15:30 IST, SIGTERM or Ctrl+C (D49); no data job, no switch."""
    if settings.kite_api_key is None or settings.broker_token_key is None:
        raise ValueError("Set NOVA_KITE_API_KEY and NOVA_BROKER_TOKEN_KEY first")
    with factory() as db:
        tokens = tick_symbols(db, symbols)
        cipher = TokenCipher(settings.broker_token_key.get_secret_value())
        _, access_token = active_session(db, cipher)

    # Any: rows are `ticks` column values for a bulk insert.
    def sink(rows: list[dict[str, Any]]) -> None:
        with factory() as db:
            db.execute(insert(Tick).on_conflict_do_nothing(), rows)
            db.commit()

    stop = _stop_on_signals()

    def should_stop() -> bool:
        return stop.is_set() or datetime.now(IST).time() >= MARKET_CLOSE

    recorder = Recorder(
        url=kite_url(settings.kite_api_key.get_secret_value(), access_token),
        symbols=tokens,
        sink=sink,
        connect=connect,
        should_stop=should_stop,
        now=lambda: datetime.now(UTC),
    )
    asyncio.run(recorder.run())


def run_recorder(settings: BrokerSettings, factory: sessionmaker[Session]) -> None:
    """The always-on recorder (D54): follows Relay's switch until SIGTERM."""
    api_key = settings.kite_api_key.get_secret_value() if settings.kite_api_key else None
    token_key = settings.broker_token_key
    cipher = TokenCipher(token_key.get_secret_value()) if token_key else None
    if api_key is None or cipher is None:
        logging.getLogger("nova.broker").warning(
            "NOVA_KITE_API_KEY or NOVA_BROKER_TOKEN_KEY is not set: the recorder only waits"
        )
    RecorderLoop(factory=factory, api_key=api_key, cipher=cipher, stop=_stop_on_signals()).run()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_broker")
    commands = parser.add_subparsers(dest="command", required=True)
    add = commands.add_parser("add-account", help="add a Zerodha account")
    add.add_argument("--label", required=True)
    add.add_argument("--client-id", required=True)
    commands.add_parser("new-token-key", help="print a new NOVA_BROKER_TOKEN_KEY")
    record = commands.add_parser("record-ticks", help="record live ticks now, until 15:30 IST")
    record.add_argument("--symbols", default="", help="comma-separated; default: all with a token")
    commands.add_parser("recorder", help="always-on recorder that follows Relay's switch")
    args = parser.parse_args(argv)

    if args.command == "new-token-key":
        print(new_key())
        return 0

    settings = get_broker_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    if args.command in ("record-ticks", "recorder"):
        logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")
        factory = create_session_factory(engine)
        try:
            if args.command == "recorder":
                run_recorder(settings, factory)
            else:
                symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
                record_ticks(settings, factory, symbols)
        except (ValueError, ApiException) as exc:
            print(exc, file=sys.stderr)
            return 1
        finally:
            engine.dispose()
        return 0
    try:
        with create_session_factory(engine)() as db:
            account = add_account(db, label=args.label, client_id=args.client_id)
            db.commit()
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1
    finally:
        engine.dispose()
    print(f"Added {account.label} ({account.client_id}) as {account.id}")
    return 0
