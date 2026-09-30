from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from nova_atlas import live
from nova_atlas.archive import archive_ticks
from nova_atlas.live_storage import session_window
from nova_db.models import Candle, Instrument, Tick, UniverseEntry
from nova_testing.parity import Parity
from sqlalchemy import Engine
from sqlalchemy.orm import Session

OPEN = datetime(2026, 9, 30, 3, 45, tzinfo=UTC)
SNAPSHOT = "/api/v1/live/snapshot"
DAYS = "/api/v1/live/days"


def tick(symbol: str, at: datetime, price: int = 110) -> Tick:
    return Tick(
        exchange="NSE",
        symbol=symbol,
        received_at=at,
        exchange_ts=at - timedelta(seconds=10),
        last_price_paise=price,
        last_qty=1,
        volume=10,
        oi=None,
    )


@pytest.fixture
def seeded(
    client: TestClient, clean: Engine, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Engine:
    assert isinstance(client.app, FastAPI)
    client.app.state.settings = client.app.state.settings.model_copy(
        update={"archive_dir": tmp_path}
    )
    monkeypatch.setattr(live, "clock", lambda: OPEN + timedelta(seconds=4))
    with Session(clean) as db:
        db.add(
            Instrument(
                exchange="NSE",
                symbol="INFY",
                name="Infosys",
                sector="IT",
                segment="equity_delivery",
                indices=[],
            )
        )
        db.flush()
        db.add(
            Candle(
                exchange="NSE",
                symbol="INFY",
                timeframe="1d",
                ts=OPEN - timedelta(days=1),
                open_paise=100,
                high_paise=100,
                low_paise=100,
                close_paise=100,
                volume=1,
            )
        )
        db.add_all(
            [
                tick("INFY", OPEN),
                tick("INFY", OPEN + timedelta(microseconds=100), 111),
                tick("INFY", OPEN + timedelta(seconds=2)),
                tick("TCS", OPEN),
                tick("TCS", OPEN + timedelta(seconds=1)),
                tick("TCS", OPEN + timedelta(seconds=3)),
            ]
        )
        db.commit()
    return clean


def test_today_classifies_faults_and_shared_silence(
    client: TestClient, seeded: Engine, parity: Parity
) -> None:
    row = client.get(DAYS, params={"symbol": "INFY"}).json()[0]
    assert row | {"sizeBytes": 0} == {
        "symbol": "INFY",
        "day": "2026-09-30",
        "tickCount": 3,
        "candleCount": 2,
        "secondsExpected": 5,
        "missingSeconds": 2,
        "noTradeSeconds": 1,
        "sizeBytes": 0,
    }
    assert row["sizeBytes"] > 0
    parity.assert_valid(row, "LiveDaySummary")


def test_snapshot_prices_and_no_tick_stock(
    client: TestClient, seeded: Engine, parity: Parity
) -> None:
    response = client.get(SNAPSHOT, params={"symbols": "INFY,RELIANCE"})
    assert response.status_code == 200
    infy, reliance = response.json()
    assert infy == {
        "symbol": "INFY",
        "price": 110,
        "changePercent": 10.0,
        "at": "2026-09-30T03:45:02Z",
        "secondsWithTick": 2,
        "secondsExpected": 5,
    }
    assert reliance == {
        "symbol": "RELIANCE",
        "price": None,
        "changePercent": None,
        "at": None,
        "secondsWithTick": 0,
        "secondsExpected": 5,
    }
    for row in response.json():
        parity.assert_valid(row, "LiveSnapshotItem")


def test_completely_missing_stock_is_fault_only_during_other_activity(
    client: TestClient, seeded: Engine
) -> None:
    row = client.get(DAYS, params={"symbol": "RELIANCE"}).json()[0]
    assert (row["tickCount"], row["candleCount"], row["missingSeconds"], row["noTradeSeconds"]) == (
        0,
        0,
        4,
        1,
    )


def test_archived_days_preserve_gap_classification_and_snapshot(
    client: TestClient,
    seeded: Engine,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(live, "clock", lambda: OPEN + timedelta(days=1))
    before = client.get(DAYS, params={"symbol": "INFY"}).json()
    with Session(seeded) as db:
        paths = archive_ticks(db, tmp_path, date(2026, 10, 1))
    after = client.get(DAYS, params={"symbol": "INFY"}).json()
    assert len(before) == len(after) == 1
    assert before[0] | {"sizeBytes": 0} == after[0] | {"sizeBytes": 0}
    assert after[0]["sizeBytes"] == next(
        path.stat().st_size for path in paths if "symbol=INFY" in str(path)
    )
    assert after[0]["secondsExpected"] == 22_500
    snap = client.get(SNAPSHOT, params={"symbols": "INFY"}).json()[0]
    assert snap["price"] == 110 and snap["at"] == "2026-09-30T03:45:02Z"
    assert snap["secondsWithTick"] == 0


def test_mixed_database_and_archive_activity_counts_one_union(
    client: TestClient,
    seeded: Engine,
    tmp_path: Path,
) -> None:
    with Session(seeded) as db:
        archive_ticks(db, tmp_path, date(2026, 10, 1))
        db.add(tick("TCS", OPEN + timedelta(seconds=4)))
        db.commit()
    row = client.get(DAYS, params={"symbol": "INFY"}).json()[0]
    assert row["missingSeconds"] == 3 and row["noTradeSeconds"] == 0


@pytest.mark.parametrize(
    "symbols", ["INFY,INFY", "../INFY", "", ",", ",".join(f"S{i}" for i in range(501))]
)
def test_bad_snapshot_selection(client: TestClient, symbols: str) -> None:
    assert client.get(SNAPSHOT, params={"symbols": symbols}).status_code in (400, 422)


@pytest.mark.parametrize(
    "path,params", [(SNAPSHOT, {"symbols": "UNKNOWN"}), (DAYS, {"symbol": "UNKNOWN"})]
)
def test_unknown_stock(client: TestClient, path: str, params: dict[str, str]) -> None:
    assert client.get(path, params=params).status_code == 404


def test_empty_history_and_path_validation(client: TestClient) -> None:
    assert client.get(DAYS, params={"symbol": "INFY"}).json() == []
    assert client.get(DAYS, params={"symbol": "../INFY"}).status_code == 400
    assert (
        client.get(
            SNAPSHOT, params={"symbols": "INFY"}, headers={"x-nova-internal-token": "wrong"}
        ).status_code
        == 401
    )


def test_expected_seconds_before_open_after_close_and_weekend() -> None:
    assert session_window(OPEN.date(), OPEN - timedelta(microseconds=1))[1] == 0
    assert session_window(OPEN.date(), OPEN)[1] == 1
    assert session_window(OPEN.date(), OPEN + timedelta(hours=7))[1] == 22_500
    saturday = OPEN + timedelta(days=3)
    assert session_window(saturday.date(), saturday + timedelta(hours=1))[1] == 0


def test_snapshot_supports_500_stocks_including_unrecorded_stocks(
    client: TestClient, seeded: Engine
) -> None:
    symbols = ["INFY", "TCS", *(f"S{i}" for i in range(498))]
    with Session(seeded) as db:
        db.add_all(
            UniverseEntry(
                exchange="NSE", symbol=symbol, name=symbol, sector="Unclassified", indices=[]
            )
            for symbol in symbols[2:]
        )
        db.commit()
    response = client.get(SNAPSHOT, params={"symbols": ",".join(symbols)})
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 500
    assert [row["secondsWithTick"] for row in rows[:3]] == [2, 3, 0]
    assert all(row["price"] is None for row in rows[2:])


def test_snapshot_occupied_seconds_survive_archiving(
    client: TestClient, seeded: Engine, tmp_path: Path
) -> None:
    before = client.get(SNAPSHOT, params={"symbols": "INFY,TCS"}).json()
    with Session(seeded) as db:
        archive_ticks(db, tmp_path, date(2026, 10, 1))
    assert client.get(SNAPSHOT, params={"symbols": "INFY,TCS"}).json() == before
