from datetime import date

import pytest
from fastapi.testclient import TestClient
from nova_atlas.jobs import queue_download
from nova_db.models import AuditEntry, Instrument, UniverseEntry
from nova_testing.broker import FakeBroker
from nova_testing.parity import Parity
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

UNIVERSE = "/api/v1/market-data/universe"
SYNC = "/api/v1/market-data/instruments/sync"
NEW = {"symbol": "M&M", "name": " Mahindra & Mahindra ", "sector": "Automobile", "indices": []}


def _audit(engine: Engine) -> list[AuditEntry]:
    with Session(engine) as db:
        return list(db.scalars(select(AuditEntry).order_by(AuditEntry.at)))


def test_list_shows_every_stock_and_whether_kite_knows_it(
    client: TestClient, clean: Engine, parity: Parity
) -> None:
    with Session(clean) as db:
        db.add(
            Instrument(
                exchange="NSE",
                symbol="INFY",
                name="Infosys",
                segment="equity_delivery",
                sector="Information Technology",
                instrument_token=408065,
            )
        )
        db.commit()

    rows = client.get(UNIVERSE).json()

    assert len(rows) == 24
    for row in rows:
        parity.assert_valid(row, "UniverseEntry")
    assert {row["symbol"] for row in rows if row["synced"]} == {"INFY"}


def test_add_stores_a_trimmed_stock_and_audits_it(
    client: TestClient, clean: Engine, parity: Parity
) -> None:
    response = client.post(UNIVERSE, json=NEW)

    assert response.status_code == 201
    parity.assert_valid(response.json(), "UniverseEntry")
    assert response.json()["name"] == "Mahindra & Mahindra"
    assert response.json()["synced"] is False
    [entry] = _audit(clean)
    assert entry.action == "instrument.add" and entry.target_type == "instrument"
    assert entry.target_id == "M&M" and entry.actor_name == "Aarav Sharma"


@pytest.mark.parametrize(
    "body",
    [
        NEW | {"symbol": "INFY"},
        NEW | {"symbol": "m&m"},
        NEW | {"indices": ["SENSEX"]},
        NEW | {"name": ""},
    ],
)
def test_add_rejects_duplicates_and_bad_bodies(client: TestClient, body: dict[str, object]) -> None:
    response = client.post(UNIVERSE, json=body)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_update_changes_name_sector_and_indices(client: TestClient, clean: Engine) -> None:
    body = {"symbol": "INFY", "name": "Infosys Ltd", "sector": "IT", "indices": ["NIFTY 50"]}

    response = client.put(f"{UNIVERSE}/INFY", json=body)

    assert response.status_code == 200 and response.json()["name"] == "Infosys Ltd"
    with Session(clean) as db:
        row = db.get(UniverseEntry, ("NSE", "INFY"))
    assert row is not None and row.sector == "IT"
    assert [e.action for e in _audit(clean)] == ["instrument.update"]


def test_update_refuses_another_symbol_and_unknown_ones(client: TestClient) -> None:
    body = NEW | {"symbol": "TCS"}

    assert client.put(f"{UNIVERSE}/INFY", json=body).status_code == 400
    assert client.put(f"{UNIVERSE}/NOPE", json=NEW | {"symbol": "NOPE"}).status_code == 404


def test_remove_deletes_the_stock_but_not_its_instrument(client: TestClient, clean: Engine) -> None:
    response = client.delete(f"{UNIVERSE}/DABUR")

    assert response.status_code == 204
    with Session(clean) as db:
        assert db.get(UniverseEntry, ("NSE", "DABUR")) is None
    assert [e.action for e in _audit(clean)] == ["instrument.remove"]
    assert client.delete(f"{UNIVERSE}/DABUR").status_code == 404


def test_remove_is_blocked_by_a_waiting_job(client: TestClient, clean: Engine) -> None:
    with Session(clean) as db:
        job = queue_download(
            db,
            symbols=["INFY", "TCS"],
            timeframe="1d",
            first=date(2026, 1, 1),
            last=date(2026, 1, 31),
            segment="equity_delivery",
        )
        db.commit()
        job_id = job.id

    response = client.delete(f"{UNIVERSE}/TCS")

    assert response.status_code == 400
    assert job_id in response.json()["error"]["message"]


def test_sync_reports_synced_and_missing_stocks(
    client: TestClient, clean: Engine, parity: Parity
) -> None:
    response = client.post(SYNC)

    assert response.status_code == 200
    result = response.json()
    parity.assert_valid(result, "InstrumentSyncResult")
    assert result["synced"] == ["INFY", "RELIANCE", "TCS"] and len(result["missing"]) == 21
    [entry] = _audit(clean)
    assert entry.action == "instrument.sync" and entry.summary.startswith("Synced 3; not on")
    synced = {row["symbol"] for row in client.get(UNIVERSE).json() if row["synced"]}
    assert synced == {"INFY", "RELIANCE", "TCS"}


def test_sync_shows_broker_errors(client: TestClient, fake_broker: FakeBroker) -> None:
    fake_broker.error = "Log in to Kite in Relay first"

    response = client.post(SYNC)

    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Log in to Kite in Relay first"


def test_needs_the_internal_token(client: TestClient) -> None:
    headers = {"x-nova-internal-token": "nope"}
    assert client.get(UNIVERSE, headers=headers).status_code == 401
    assert client.post(SYNC, headers=headers).status_code == 401
