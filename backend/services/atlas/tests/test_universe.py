from datetime import date

import pytest
from nova_atlas.broker_client import BrokerData, BrokerDataError
from nova_atlas.universe import load_universe, sync_instruments
from nova_db.models import Instrument
from nova_testing.broker import FakeBroker
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session


def test_the_seeded_stock_list_is_loaded_by_symbol(clean: Engine) -> None:
    with Session(clean) as db:
        rows = load_universe(db)

    symbols = [row.symbol for row in rows]
    assert len(rows) == 24 and symbols == sorted(symbols)
    assert {"INFY", "TCS", "RELIANCE"} <= set(symbols)


def test_sync_sets_tokens_and_the_nearest_future_lot_size(
    clean: Engine, broker: BrokerData
) -> None:
    with Session(clean) as db:
        result = sync_instruments(db, broker, today=date(2026, 9, 25))
        rows = {i.symbol: i for i in db.scalars(select(Instrument))}

    assert result.synced == ["INFY", "RELIANCE", "TCS"]
    assert len(result.missing) == 21
    assert rows["INFY"].instrument_token == 408065
    assert rows["INFY"].lot_size == 300  # September future, not October's 400
    assert rows["TCS"].lot_size is None  # no future in the dump
    assert rows["RELIANCE"].sector == "Energy" and rows["RELIANCE"].indices == ["NIFTY 50"]


def test_expired_futures_are_ignored(clean: Engine, broker: BrokerData) -> None:
    with Session(clean) as db:
        sync_instruments(db, broker, today=date(2026, 10, 1))
        infy = db.get(Instrument, ("NSE", "INFY"))

    assert infy is not None and infy.lot_size == 400


def test_broker_errors_surface(clean: Engine, broker: BrokerData, fake_broker: FakeBroker) -> None:
    fake_broker.error = "Log in to Kite in Relay first"

    with Session(clean) as db, pytest.raises(BrokerDataError, match="Log in to Kite"):
        sync_instruments(db, broker)
