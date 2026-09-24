"""A throwaway PostgreSQL database per test session (D37).

`NOVA_TEST_DATABASE_URL` points at the maintenance database; `backend-check` sets it. Without it
(quick host runs) the database tests are skipped.
"""

import os
import secrets
from collections.abc import Iterator

import pytest
from nova_db.migrate import upgrade
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    admin_url = os.environ.get("NOVA_TEST_DATABASE_URL")
    if not admin_url:
        pytest.skip("NOVA_TEST_DATABASE_URL is not set (database tests run in backend-check)")
    name = f"nova_test_{secrets.token_hex(4)}"
    admin = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    try:
        yield make_url(admin_url).set(database=name).render_as_string(hide_password=False)
    finally:
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()


@pytest.fixture(scope="session")
def engine(database_url: str) -> Iterator[Engine]:
    upgrade(database_url)
    db_engine = create_engine(database_url)
    yield db_engine
    db_engine.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    """A session whose work is rolled back after the test."""
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            yield db
        transaction.rollback()
