import json
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from nova_db.models import AuditEntry, BacktestResult, BacktestRun, StrategyVersion
from nova_testing.parity import Parity
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

STRATEGIES = "/api/v1/strategies"


def _create(client: TestClient, spec: dict[str, object], name: str = "VWAP") -> dict[str, object]:
    response = client.post(STRATEGIES, json={"name": name, "description": "Test", "spec": spec})
    assert response.status_code == 201
    body: dict[str, object] = response.json()
    return body


def test_needs_the_internal_token(client: TestClient) -> None:
    assert client.get(STRATEGIES, headers={"x-nova-internal-token": "nope"}).status_code == 401


def test_create_version_update_flow(
    client: TestClient, spec: dict[str, object], parity: Parity, clean: Engine
) -> None:
    created = _create(client, spec)
    parity.assert_valid(created, "Strategy")
    assert created["status"] == "draft" and created["latestVersion"] == 1
    strategy_id = str(created["id"])

    python_spec = spec | {"mode": "python", "code": "class Strategy: ..."}
    python_spec.pop("entry")
    python_spec.pop("exit")
    versioned = client.post(
        f"{STRATEGIES}/{strategy_id}/versions", json={"note": "Python rewrite", "spec": python_spec}
    )
    assert versioned.status_code == 201
    body = versioned.json()
    parity.assert_valid(body, "Strategy")
    assert body["latestVersion"] == 2
    assert [v["spec"]["mode"] for v in body["versions"]] == ["visual", "python"]
    assert body["versions"][0]["spec"] == spec  # version 1 is untouched

    updated = client.patch(
        f"{STRATEGIES}/{strategy_id}", json={"status": "active", "name": "VWAP 2"}
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "active" and updated.json()["name"] == "VWAP 2"

    assert client.get(f"{STRATEGIES}/{strategy_id}").json() == updated.json()
    assert [s["id"] for s in client.get(STRATEGIES).json()] == [strategy_id]
    with Session(clean) as db:
        summaries = list(db.scalars(select(AuditEntry.summary).order_by(AuditEntry.at)))
    assert summaries == [
        "Created strategy VWAP",
        "Saved version 2 of VWAP",
        "Updated VWAP 2: name, status active",
    ]


@pytest.mark.parametrize(
    ("method", "path", "body", "status"),
    [
        ("post", "", {"name": "", "description": "", "spec": {}}, 400),
        ("post", "/stg_nope/versions", {"note": "", "spec": None}, 400),
        ("patch", "/stg_nope", {"status": "active"}, 404),
        ("get", "/stg_nope", None, 404),
    ],
)
def test_bad_requests(
    client: TestClient, method: str, path: str, body: dict[str, object] | None, status: int
) -> None:
    response = client.request(method.upper(), f"{STRATEGIES}{path}", json=body)

    assert response.status_code == status


def test_empty_or_unknown_update_is_refused(client: TestClient, spec: dict[str, object]) -> None:
    strategy_id = _create(client, spec)["id"]

    assert client.patch(f"{STRATEGIES}/{strategy_id}", json={}).status_code == 400
    assert (
        client.patch(f"{STRATEGIES}/{strategy_id}", json={"status": "deleted"}).status_code == 400
    )


def test_bad_indicator_settings_are_refused(client: TestClient, spec: dict[str, object]) -> None:
    """D51: the catalog decides which settings an indicator has."""
    bad = json.loads(json.dumps(spec))
    left = {"kind": "indicator", "name": "macd", "params": {"period": 20}}
    bad["entry"]["conditions"][0]["left"] = left

    response = client.post(STRATEGIES, json={"name": "M", "description": "", "spec": bad})

    assert response.status_code == 400
    assert "Unknown setting 'period' for MACD line" in response.json()["error"]["message"]


def _backtest(db: Session, run_id: str, strategy_id: str, status: str) -> None:
    db.add(
        BacktestRun(
            id=run_id,
            root_id=run_id,
            strategy_id=strategy_id,
            strategy_version=1,
            name=run_id,
            universe={"type": "index", "index": "NIFTY 50"},
            status=status,
            date_from=date(2025, 1, 1),
            date_to=date(2025, 12, 31),
            initial_capital_paise=100_000_000,
            benchmark=None,
        )
    )


def _result(run_id: str) -> BacktestResult:
    return BacktestResult(
        run_id=run_id,
        gross_pnl_paise=200,
        charges_paise=100,
        net_pnl_paise=100,
        return_percent=Decimal("1"),
        cagr_percent=Decimal("1"),
        max_drawdown_percent=Decimal("-1"),
        sharpe=Decimal("1"),
        win_rate_percent=Decimal("50"),
        trade_count=2,
        win_count=1,
        loss_count=1,
        equity_curve=[],
        by_symbol=[],
    )


def test_delete_removes_versions_and_backtests(
    client: TestClient, spec: dict[str, object], clean: Engine, parity: Parity
) -> None:
    doomed = str(_create(client, spec, name="Doomed")["id"])
    kept = str(_create(client, spec, name="Kept")["id"])
    with Session(clean) as db:
        _backtest(db, "run_a", doomed, "completed")
        _backtest(db, "run_b", doomed, "queued")
        _backtest(db, "run_c", kept, "completed")
        db.flush()
        db.add(_result("run_a"))
        db.commit()

    response = client.delete(f"{STRATEGIES}/{doomed}")

    assert response.status_code == 200
    parity.assert_valid(response.json(), "BacktestDeleteResult")
    assert response.json() == {"deletedRuns": 2}
    assert client.get(f"{STRATEGIES}/{doomed}").status_code == 404
    assert [s["id"] for s in client.get(STRATEGIES).json()] == [kept]
    with Session(clean) as db:
        assert list(db.scalars(select(BacktestRun.id))) == ["run_c"]
        assert db.scalars(select(BacktestResult.run_id)).all() == []
        assert db.scalars(select(StrategyVersion.strategy_id)).all() == [kept]
        audit = db.scalars(select(AuditEntry).where(AuditEntry.action == "strategy.delete")).one()
    assert audit.summary == "Deleted strategy Doomed (2 backtest runs)"
    assert audit.target_id == doomed


def test_delete_waits_for_a_running_backtest(
    client: TestClient, spec: dict[str, object], clean: Engine
) -> None:
    busy = str(_create(client, spec, name="Busy")["id"])
    with Session(clean) as db:
        _backtest(db, "run_busy", busy, "running")
        db.commit()

    response = client.delete(f"{STRATEGIES}/{busy}")

    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Wait for the running backtest to finish"
    assert client.get(f"{STRATEGIES}/{busy}").status_code == 200
    with Session(clean) as db:
        assert list(db.scalars(select(BacktestRun.id))) == ["run_busy"]


def test_delete_unknown_strategy_is_404(client: TestClient) -> None:
    assert client.delete(f"{STRATEGIES}/stg_nope").status_code == 404
