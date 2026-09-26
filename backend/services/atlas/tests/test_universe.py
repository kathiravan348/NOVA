from datetime import date

import pytest
from nova_atlas.broker_client import BrokerData, BrokerDataError
from nova_atlas.universe import kite_stocks, load_universe, sync_instruments
from nova_db.models import Instrument, MarketIndex, UniverseEntry
from nova_testing.broker import FakeBroker
from sqlalchemy import Engine, delete, select
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

    with Session(clean) as db, pytest.raises(BrokerDataError, match="Kite is not logged in"):
        sync_instruments(db, broker)


KITE_HEADER = (
    "instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,"
    "tick_size,lot_size,instrument_type,segment,exchange"
)


def test_kite_list_keeps_stocks_and_skips_bonds() -> None:
    rows = [
        '1,1,INFY,"INFOSYS",0,,0,0.05,1,EQ,NSE,NSE',
        '2,2,ABCD-SM,"ABCD SME",0,,0,0.05,1,EQ,NSE,NSE',
        '3,3,XYZ-BE,"XYZ",0,,0,0.05,1,EQ,NSE,NSE',
        '4,4,SGBDEC25-SG,"SGB",0,,0,0.05,1,EQ,NSE,NSE',
        '5,5,GS2030-GS,"GSEC",0,,0,0.05,1,EQ,NSE,NSE',
        '6,6,ACME-N1,"BOND",0,,0,0.05,1,EQ,NSE,NSE',
        '7,7,NIFTY IT,"NIFTY IT",0,,0,0,0,EQ,INDICES,NSE',
    ]

    stocks, indices = kite_stocks("\n".join([KITE_HEADER, *rows]))

    assert sorted(stocks) == ["ABCD-SM", "INFY", "XYZ-BE"]
    assert indices == {"NIFTY IT": 7}


def test_sync_adds_every_kite_stock_with_nse_names_and_sectors(
    clean: Engine, broker: BrokerData
) -> None:
    with Session(clean) as db:
        db.execute(delete(UniverseEntry))
        db.commit()
        result = sync_instruments(db, broker, today=date(2026, 9, 25))
        rows = {row.symbol: row for row in load_universe(db)}
        it = db.get(MarketIndex, "NIFTY IT")
        nifty = db.get(MarketIndex, "NIFTY 50")

    assert result.added == ["INFY", "TCS", "RELIANCE"] and result.new_listings == []
    assert rows["INFY"].name == "Infosys Ltd."
    assert rows["INFY"].sector == "Information Technology"
    assert rows["INFY"].indices == ["NIFTY 50", "NIFTY IT"] and not rows["INFY"].new_listing
    assert rows["RELIANCE"].indices == ["NIFTY 50"]
    assert it is not None and it.member_count == 2
    assert nifty is not None and nifty.instrument_token == 256265
    assert len(result.failed_indices) == 17  # the fake NSE has two of the 19 files


def test_a_stock_added_after_an_earlier_sync_is_a_new_listing(
    clean: Engine, broker: BrokerData
) -> None:
    with Session(clean) as db:
        db.execute(delete(UniverseEntry).where(UniverseEntry.symbol == "TCS"))
        db.commit()
        result = sync_instruments(db, broker, mark_new=True)
        tcs = db.get(UniverseEntry, ("NSE", "TCS"))

    assert result.new_listings == ["TCS"] and tcs is not None and tcs.new_listing
    assert "1 new listing(s): TCS" in result.summary()


def test_a_failed_nse_file_keeps_the_old_members(
    clean: Engine, broker: BrokerData, fake_broker: FakeBroker
) -> None:
    del fake_broker.constituents["ind_niftyitlist.csv"]
    with Session(clean) as db:
        infy = db.get(UniverseEntry, ("NSE", "INFY"))
        assert infy is not None
        infy.indices = ["NIFTY IT"]
        db.commit()
        result = sync_instruments(db, broker)
        db.refresh(infy)

    assert "NIFTY IT" in result.failed_indices and "NIFTY IT" in result.summary()
    assert infy.indices == ["NIFTY 50", "NIFTY IT"]


def test_a_hand_set_sector_is_kept(clean: Engine, broker: BrokerData) -> None:
    with Session(clean) as db:
        sync_instruments(db, broker)
        reliance = db.get(UniverseEntry, ("NSE", "RELIANCE"))

    assert reliance is not None and reliance.sector == "Energy"
