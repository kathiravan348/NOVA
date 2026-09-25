"""`python -m nova_broker add-account --label --client-id`, `new-token-key` and `record-ticks`."""

import argparse
import asyncio
import logging
import signal
import sys
import threading
from datetime import UTC, datetime, time
from typing import Any
from zoneinfo import ZoneInfo

from nova_common import ApiException
from nova_db import create_db_engine, create_session_factory
from nova_db.models import Instrument, Tick
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker
from websockets.asyncio.client import connect

from nova_broker.accounts import add_account
from nova_broker.crypto import TokenCipher, new_key
from nova_broker.internal import active_session
from nova_broker.recorder import Recorder, kite_url
from nova_broker.settings import BrokerSettings, get_broker_settings

IST = ZoneInfo("Asia/Kolkata")
MARKET_CLOSE = time(15, 30)
MAX_TOKENS = 3000  # Kite's limit per WebSocket connection


def tick_symbols(db: Session, symbols: list[str]) -> dict[int, str]:
    """Instrument token → symbol for NSE instruments with a token (all of them when none given)."""
    query = select(Instrument.instrument_token, Instrument.symbol).where(
        Instrument.exchange == "NSE", Instrument.instrument_token.is_not(None)
    )
    if symbols:
        query = query.where(Instrument.symbol.in_(symbols))
    found = {int(token): symbol for token, symbol in db.execute(query).tuples() if token}
    missing = sorted(set(symbols) - set(found.values()))
    if missing:
        raise ValueError(f"No instrument token (run sync-instruments): {', '.join(missing)}")
    if not found:
        raise ValueError("No instruments with a token: run `python -m nova_atlas sync-instruments`")
    if len(found) > MAX_TOKENS:
        raise ValueError(f"Kite allows {MAX_TOKENS} symbols per socket; give --symbols")
    return found


def record_ticks(
    settings: BrokerSettings, factory: sessionmaker[Session], symbols: list[str]
) -> None:
    """Records until 15:30 IST, SIGTERM or Ctrl+C (D49)."""
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

    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())

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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_broker")
    commands = parser.add_subparsers(dest="command", required=True)
    add = commands.add_parser("add-account", help="add a Zerodha account")
    add.add_argument("--label", required=True)
    add.add_argument("--client-id", required=True)
    commands.add_parser("new-token-key", help="print a new NOVA_BROKER_TOKEN_KEY")
    record = commands.add_parser("record-ticks", help="record live ticks until 15:30 IST")
    record.add_argument("--symbols", default="", help="comma-separated; default: all with a token")
    args = parser.parse_args(argv)

    if args.command == "new-token-key":
        print(new_key())
        return 0

    settings = get_broker_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    if args.command == "record-ticks":
        logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")
        symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
        try:
            record_ticks(settings, create_session_factory(engine), symbols)
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
