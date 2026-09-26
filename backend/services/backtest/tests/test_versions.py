"""Backtest versions, delete and slim history over HTTP (D60)."""

import threading

from fastapi.testclient import TestClient
from nova_backtest.strategy_engine import StrategyEngine
from nova_backtest.worker import run_worker
from nova_db.models import AuditEntry, BacktestResult, BacktestRun, Trade
from nova_testing.parity import Parity
from sqlalchemy import Engine, func, select, update
from sqlalchemy.orm import Session, sessionmaker
from test_engine import seeded  # noqa: F401 - fixture: INFY/TCS candles, strategy v2

__all__ = ["seeded"]

BACKTESTS = "/api/v1/backtests"


def _body(**change: object) -> dict[str, object]:
    body: dict[str, object] = {
        "strategyVersion": 2,
        "name": "IT basket",
        "universe": {"type": "symbols", "symbols": ["INFY", "TCS"]},
        "from": "2025-01-01",
        "to": "2025-01-05",
        "initialCapitalPaise": 10_000_000,
        "benchmark": None,
    }
    return body | change


def _drain(factory: sessionmaker[Session]) -> None:
    stop = threading.Event()
    run_worker(factory, StrategyEngine(), stop, poll_seconds=0, on_idle=stop.set)


def _first(client: TestClient, factory: sessionmaker[Session]) -> str:
    """v1 of a backtest, completed."""
    response = client.post(BACKTESTS, json=_body() | {"strategyId": "stg_1"})
    assert response.status_code == 201
    _drain(factory)
    return str(response.json()["id"])


def _count(engine: Engine, model: type[Trade] | type[BacktestRun], run_id: str) -> int:
    column = Trade.run_id if model is Trade else BacktestRun.id
    with Session(engine) as db:
        return int(db.scalar(select(func.count()).where(column == run_id)) or 0)


def test_edit_queues_the_next_version_and_the_list_shows_only_it(
    seeded: Engine,  # noqa: F811
    factory: sessionmaker[Session],
    client: TestClient,
    parity: Parity,
) -> None:
    v1 = _first(client, factory)

    edited = client.post(f"{BACKTESTS}/{v1}/versions", json=_body(name="IT basket 2"))

    assert edited.status_code == 201, edited.text
    v2 = edited.json()
    parity.assert_valid(v2, "BacktestRun")
    assert (v2["rootId"], v2["version"], v2["status"]) == (v1, 2, "queued")
    again = client.post(f"{BACKTESTS}/{v1}/versions", json=_body())
    assert again.status_code == 400
    assert again.json()["error"]["message"] == "Wait for the running version to finish"
    assert [r["id"] for r in client.get(BACKTESTS).json()["items"]] == [v2["id"]]
    with Session(seeded) as db:
        entry = db.scalars(select(AuditEntry).where(AuditEntry.action == "backtest.edit")).one()
    assert entry.summary == "Queued v2 of backtest IT basket 2"


def test_a_completed_version_trims_the_older_ones(
    seeded: Engine,  # noqa: F811
    factory: sessionmaker[Session],
    client: TestClient,
    parity: Parity,
) -> None:
    v1 = _first(client, factory)
    before = client.get(f"{BACKTESTS}/{v1}/result").json()["metrics"]
    assert _count(seeded, Trade, v1) == 1
    v2 = client.post(f"{BACKTESTS}/{v1}/versions", json=_body()).json()["id"]

    _drain(factory)

    old = client.get(f"{BACKTESTS}/{v1}").json()
    assert old["reportKept"] is False and _count(seeded, Trade, v1) == 0
    trimmed = client.get(f"{BACKTESTS}/{v1}/result").json()
    assert trimmed["metrics"] == before
    assert (trimmed["equityCurve"], trimmed["bySymbol"]) == ([], [])
    assert client.get(f"{BACKTESTS}/{v2}").json()["reportKept"] is True
    assert _count(seeded, Trade, v2) == 1
    versions = client.get(f"{BACKTESTS}/{v1}/versions").json()
    for version in versions:
        parity.assert_valid(version, "BacktestVersion")
    assert [(v["runId"], v["version"], v["reportKept"]) for v in versions] == [
        (v2, 2, True),
        (v1, 1, False),
    ]
    assert versions[1]["metrics"] == before


def test_delete_a_whole_backtest_or_one_old_version(
    seeded: Engine,  # noqa: F811
    factory: sessionmaker[Session],
    client: TestClient,
    parity: Parity,
) -> None:
    v1 = _first(client, factory)
    v2 = client.post(f"{BACKTESTS}/{v1}/versions", json=_body()).json()["id"]
    _drain(factory)

    newest = client.delete(f"{BACKTESTS}/{v2}", params={"scope": "version"})
    assert newest.status_code == 400
    assert newest.json()["error"]["message"] == "Delete the whole backtest instead"
    one = client.delete(f"{BACKTESTS}/{v1}", params={"scope": "version"}).json()
    parity.assert_valid(one, "BacktestDeleteResult")
    assert one == {"deletedRuns": 1} and _count(seeded, BacktestRun, v2) == 1

    assert client.delete(f"{BACKTESTS}/{v2}").json() == {"deletedRuns": 1}
    assert client.get(f"{BACKTESTS}/{v2}").status_code == 404
    with Session(seeded) as db:
        assert db.scalar(select(func.count()).select_from(BacktestResult)) == 0
        summaries = db.scalars(
            select(AuditEntry.summary)
            .where(AuditEntry.action == "backtest.delete")
            .order_by(AuditEntry.at)
        ).all()
    assert summaries == ["Deleted v1 of backtest IT basket", "Deleted backtest IT basket (1 version)"]


def test_bulk_delete_removes_every_version_and_refuses_running_runs(
    seeded: Engine,  # noqa: F811
    factory: sessionmaker[Session],
    client: TestClient,
) -> None:
    a = _first(client, factory)
    client.post(f"{BACKTESTS}/{a}/versions", json=_body())  # v2 of a, queued
    b = _first(client, factory)  # the worker also completes a's v2
    running = client.post(BACKTESTS, json=_body() | {"strategyId": "stg_1"}).json()["id"]
    with Session(seeded) as db:
        db.execute(update(BacktestRun).where(BacktestRun.id == running).values(status="running"))
        db.commit()

    refused = client.post(f"{BACKTESTS}/delete", json={"ids": [a, running]})
    assert refused.status_code == 400
    assert refused.json()["error"]["message"] == "A running backtest cannot be deleted"
    assert client.post(f"{BACKTESTS}/delete", json={"ids": [a, b]}).json() == {"deletedRuns": 3}
    assert [r["id"] for r in client.get(BACKTESTS).json()["items"]] == [running]
    assert client.post(f"{BACKTESTS}/delete", json={"ids": ["run_nope"]}).status_code == 404
