from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from nova_backtest.main import create_app
from nova_backtest.settings import BacktestSettings
from nova_db.models import Instrument, Strategy, StrategyVersion, User
from nova_testing.db import database_url, engine, session
from nova_testing.parity import Parity
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session, sessionmaker

__all__ = ["database_url", "engine", "session"]

TOKEN = "internal-test-token"


@pytest.fixture(scope="session")
def parity() -> Parity:
    return Parity()


@pytest.fixture
def clean(engine: Engine, parity: Parity) -> Engine:
    """Owner, one strategy (`stg_1`, version 1 = the first mock spec) and INFY/TCS instruments."""
    with engine.begin() as connection:
        connection.execute(
            text("TRUNCATE strategies, instruments, candles, audit_entries, users CASCADE")
        )
    spec = parity.mock("strategies")[0]["versions"][0]["spec"]
    with Session(engine) as db:
        db.add(User(id="usr_owner", name="Aarav Sharma", email="a@example.com", password_hash="x"))
        db.add(Strategy(id="stg_1", name="VWAP", status="active", latest_version=1))
        db.flush()
        db.add(StrategyVersion(strategy_id="stg_1", version=1, spec=spec))
        for symbol in ("INFY", "TCS"):
            db.add(
                Instrument(
                    exchange="NSE",
                    symbol=symbol,
                    name=symbol,
                    segment="equity_delivery",
                    sector="Information Technology",
                    indices=["NIFTY 50"],
                )
            )
        db.commit()
    return engine


@pytest.fixture
def factory(clean: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=clean, expire_on_commit=False)


@pytest.fixture
def client(database_url: str, clean: Engine) -> Iterator[TestClient]:
    settings = BacktestSettings.model_validate(
        {
            "database_url": database_url,
            "redis_url": "redis://unused:6379/0",
            "internal_token": TOKEN,
        }
    )
    headers = {
        "x-nova-internal-token": TOKEN,
        "x-nova-user-id": "usr_owner",
        "x-nova-user-name": "Aarav%20Sharma",
    }
    with TestClient(create_app(settings), headers=headers) as test_client:
        yield test_client


@pytest.fixture
def run_body() -> dict[str, object]:
    return {
        "strategyId": "stg_1",
        "strategyVersion": 1,
        "name": "IT basket",
        "universe": {"type": "symbols", "symbols": ["INFY", "TCS"]},
        "from": "2025-01-01",
        "to": "2025-06-30",
        "initialCapitalPaise": 10_000_000,
        "benchmark": None,
    }
