"""`python -m nova_core create-admin --email --name`: creates the super-admin (D12, D38).

The password comes from `NOVA_ADMIN_PASSWORD` or a prompt, never from the command line.
"""

import argparse
import getpass
import os
import sys

from nova_contracts import LoginRequest
from nova_db import create_db_engine, create_session_factory, new_id
from nova_db.enums import ROLE_SUPER_ADMIN
from nova_db.models import User, UserRole
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nova_core.passwords import hash_password
from nova_core.settings import get_core_settings

MIN_PASSWORD_LENGTH = 12


def create_admin(db: Session, *, email: str, name: str, password: str) -> User:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    try:
        LoginRequest(email=email, password=password)
    except ValidationError as exc:
        raise ValueError("Email or password is not valid") from exc
    if db.scalar(select(User.id).where(func.lower(User.email) == email.lower())):
        raise ValueError(f"A user with email {email} already exists")
    user = User(
        id=new_id("usr"), name=name, email=email.lower(), password_hash=hash_password(password)
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role_id=ROLE_SUPER_ADMIN))
    return user


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_core")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-admin", help="create the super-admin user")
    create.add_argument("--email", required=True)
    create.add_argument("--name", required=True)
    args = parser.parse_args(argv)

    password = os.environ.get("NOVA_ADMIN_PASSWORD") or getpass.getpass("Password: ")
    settings = get_core_settings()
    engine = create_db_engine(settings.database_url.get_secret_value())
    try:
        with create_session_factory(engine)() as db:
            user = create_admin(db, email=args.email, name=args.name, password=password)
            db.commit()
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1
    finally:
        engine.dispose()
    print(f"Created super-admin {user.email} ({user.id})")
    return 0
