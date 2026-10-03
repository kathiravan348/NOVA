"""`GET` / `PUT /broker/recorder`: Relay's switch for live tick recording (D54)."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from nova_db.models import AuditEntry, DataJob
from nova_testing.parity import Parity
from sqlalchemy import Engine, select, text
from sqlalchemy.orm import Session

RECORDER = "/api/v1/broker/recorder"


def test_starts_off(client: TestClient, synced: Engine, parity: Parity) -> None:
    body = client.get(RECORDER).json()

    parity.assert_valid(body, "RecorderSettings")
    assert body["enabled"] is False and body["state"] == "off" and body["jobId"] is None


def test_turning_on_saves_the_stocks_and_audits(
    client: TestClient, synced: Engine, parity: Parity
) -> None:
    response = client.put(RECORDER, json={"enabled": True, "symbols": ["TCS", "INFY", "TCS"]})

    assert response.status_code == 200
    body = response.json()
    parity.assert_valid(body, "RecorderSettings")
    assert body["enabled"] is True and body["symbols"] == ["INFY", "TCS"]
    assert body["state"] in ("waiting", "no_login")
    with Session(synced) as db:
        entry = db.scalars(select(AuditEntry)).one()
    assert entry.action == "settings.update" and entry.summary == "Tick recording on: 2 stock(s)"
    assert entry.target_type == "settings" and entry.target_id == "recorder"


def test_empty_list_means_every_synced_stock(client: TestClient, synced: Engine) -> None:
    client.put(RECORDER, json={"enabled": True, "symbols": []})
    client.put(RECORDER, json={"enabled": False, "symbols": []})

    with Session(synced) as db:
        summaries = [e.summary for e in db.scalars(select(AuditEntry).order_by(AuditEntry.at))]
    assert summaries == ["Tick recording on: all 2 synced stock(s)", "Tick recording off"]


@pytest.mark.parametrize(
    ("symbols", "message"),
    [(["NOTOKEN"], "Not synced with Kite yet: NOTOKEN"), (["NOPE"], "Not synced with Kite yet")],
)
def test_turning_on_needs_synced_stocks(
    client: TestClient, synced: Engine, symbols: list[str], message: str
) -> None:
    response = client.put(RECORDER, json={"enabled": True, "symbols": symbols})

    assert response.status_code == 400
    assert response.json()["error"]["message"].startswith(message)


def test_nothing_synced_is_refused(client: TestClient, synced: Engine) -> None:
    with synced.begin() as connection:
        connection.execute(text("TRUNCATE instruments"))

    response = client.put(RECORDER, json={"enabled": True, "symbols": []})

    assert response.status_code == 400
    assert "No stock is synced" in response.json()["error"]["message"]


def test_a_running_recording_shows_its_job(client: TestClient, synced: Engine) -> None:
    client.put(RECORDER, json={"enabled": True, "symbols": []})
    with Session(synced) as db:
        db.add(
            DataJob(
                id="job_ticks",
                type="tick_record",
                status="running",
                exchange="NSE",
                segment="equity_delivery",
                symbols=["INFY"],
                started_at=datetime.now(UTC),
            )
        )
        db.commit()

    body = client.get(RECORDER).json()

    assert body["state"] == "recording" and body["jobId"] == "job_ticks"


def test_with_a_live_session_it_waits_for_market_hours(
    client: TestClient, kite_session: str
) -> None:
    client.put(RECORDER, json={"enabled": True, "symbols": []})

    assert client.get(RECORDER).json()["state"] == "waiting"


def test_needs_the_internal_token(client: TestClient) -> None:
    headers = {"x-nova-internal-token": "nope"}
    assert client.get(RECORDER, headers=headers).status_code == 401
    body = {"enabled": False, "symbols": []}
    assert client.put(RECORDER, json=body, headers=headers).status_code == 401


def test_indices_saved_and_kept_when_omitted_or_null(client: TestClient, synced: Engine) -> None:
    with synced.begin() as connection:
        connection.execute(
            text("UPDATE market_indices SET instrument_token = 256265 WHERE name = 'NIFTY 50'")
        )
    saved = client.put(
        RECORDER, json={"enabled": True, "symbols": ["INFY"], "indices": ["NIFTY 50"]}
    )
    assert saved.status_code == 200 and saved.json()["indices"] == ["NIFTY 50"]
    for extra in ({}, {"indices": None}):
        response = client.put(RECORDER, json={"enabled": False, "symbols": ["INFY"]} | extra)
        assert response.json()["indices"] == ["NIFTY 50"]
    assert client.get(RECORDER).json()["indices"] == ["NIFTY 50"]


@pytest.mark.parametrize("name", ["UNKNOWN INDEX", "NIFTY 50"])
def test_unsynced_or_unknown_index_is_rejected(
    client: TestClient, synced: Engine, name: str
) -> None:
    with synced.begin() as connection:
        connection.execute(text("UPDATE market_indices SET instrument_token = NULL"))
    response = client.put(RECORDER, json={"enabled": False, "symbols": ["INFY"], "indices": [name]})
    assert response.status_code == 400 and name in response.json()["error"]["message"]


def test_stocks_and_indices_share_the_3000_limit(client: TestClient, synced: Engine) -> None:
    with synced.begin() as connection:
        names = (
            connection.execute(text("SELECT name FROM market_indices ORDER BY name LIMIT 11"))
            .scalars()
            .all()
        )
        assert len(names) == 11
        for token, name in enumerate(names, 100):
            connection.execute(
                text("UPDATE market_indices SET instrument_token = :token WHERE name = :name"),
                {"token": token, "name": name},
            )
    response = client.put(
        RECORDER,
        json={"enabled": False, "symbols": [f"S{i}" for i in range(2990)], "indices": names},
    )
    assert response.status_code == 400
    assert (
        response.json()["error"]["message"]
        == "Kite streams at most 3000 instruments: 2990 stocks + 11 indices"
    )
