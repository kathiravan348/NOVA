"""`python -m nova_broker add-account --label --client-id` and `new-token-key`."""

import argparse
import re
import sys

from nova_db import create_db_engine, create_session_factory, new_id
from nova_db.models import BrokerAccount
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nova_broker.crypto import new_key
from nova_broker.settings import get_broker_settings

CLIENT_ID = re.compile(r"^[A-Za-z0-9]{4,12}$")


def add_account(db: Session, *, label: str, client_id: str) -> BrokerAccount:
    if not label.strip():
        raise ValueError("Label must not be empty")
    if not CLIENT_ID.fullmatch(client_id):
        raise ValueError("Client id must be 4-12 letters or digits (your Zerodha user id)")
    exists = db.scalar(
        select(BrokerAccount.id).where(func.upper(BrokerAccount.client_id) == client_id.upper())
    )
    if exists:
        raise ValueError(f"Account {client_id} already exists")
    account = BrokerAccount(
        id=new_id("brk"), broker="zerodha", label=label.strip(), client_id=client_id.upper()
    )
    db.add(account)
    return account


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_broker")
    commands = parser.add_subparsers(dest="command", required=True)
    add = commands.add_parser("add-account", help="add a Zerodha account")
    add.add_argument("--label", required=True)
    add.add_argument("--client-id", required=True)
    commands.add_parser("new-token-key", help="print a new NOVA_BROKER_TOKEN_KEY")
    args = parser.parse_args(argv)

    if args.command == "new-token-key":
        print(new_key())
        return 0

    engine = create_db_engine(get_broker_settings().database_url.get_secret_value())
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
