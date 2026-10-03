from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from nova_db.models import BacktestResult, BacktestRun
from nova_testing.parity import Parity
from sqlalchemy import Engine
from sqlalchemy.orm import Session

STATS = "/api/v1/strategies/stats"
T0 = datetime(2026, 9, 1, tzinfo=UTC)


def _run(run_id: str, strategy_id: str, status: str, minutes: int, version: int = 1) -> BacktestRun:
    return BacktestRun(
        id=run_id,
        strategy_id=strategy_id,
        strategy_version=version,
        name=run_id,
        universe={"type": "index", "index": "NIFTY 50"},
        status=status,
        date_from=date(2025, 1, 1),
        date_to=date(2025, 12, 31),
        initial_capital_paise=50_000_000,
        benchmark=None,
        created_at=T0 + timedelta(minutes=minutes),
        error="boom" if status == "failed" else None,
    )


def _result(
    run_id: str, ret: str, win: str, drawdown: str, net: int, cagr: str = "1"
) -> BacktestResult:
    return BacktestResult(
        run_id=run_id,
        gross_pnl_paise=net + 100,
        charges_paise=100,
        net_pnl_paise=net,
        return_percent=Decimal(ret),
        cagr_percent=Decimal(cagr),
        max_drawdown_percent=Decimal(drawdown),
        sharpe=Decimal("1"),
        win_rate_percent=Decimal(win),
        trade_count=10,
        win_count=5,
        loss_count=5,
        equity_curve=[],
        by_symbol=[],
    )


def test_stats_summarise_runs_per_strategy(
    client: TestClient, spec: dict[str, object], clean: Engine, parity: Parity
) -> None:
    ids = []
    for name in ("Busy", "Idle", "Failing"):
        response = client.post(
            "/api/v1/strategies", json={"name": name, "description": "", "spec": spec}
        )
        ids.append(response.json()["id"])
    busy, idle, failing = ids
    longer = _run("run_b", busy, "completed", 2)
    longer.date_from = date(2024, 1, 1)
    with Session(clean) as db:
        db.add_all(
            [
                _run("run_a", busy, "completed", 1),
                longer,
                _run("run_c", busy, "running", 3),
                _run("run_d", busy, "queued", 4),
                _run("run_e", failing, "failed", 5),
            ]
        )
        db.flush()
        db.add_all(
            [
                _result("run_a", "12.5", "60", "-8.25", 1_250_000, cagr="12.5"),
                _result("run_b", "-3.1", "40", "-15.5", -310_000, cagr="-1.56"),
            ]
        )
        db.commit()

    body = {row["strategyId"]: row for row in client.get(STATS).json()}

    for row in body.values():
        parity.assert_valid(row, "StrategyStats")
    assert body[busy] == {
        "strategyId": busy,
        "runsTotal": 4,
        "runsCompleted": 2,
        "runsFailed": 0,
        "runsInProgress": 2,
        "lastRunAt": "2026-09-01T00:04:00Z",
        "bestReturnPercent": 12.5,
        "worstReturnPercent": -3.1,
        "bestCagrPercent": 12.5,
        "worstCagrPercent": -1.56,
        "winRateMinPercent": 40.0,
        "winRateMaxPercent": 60.0,
        "worstDrawdownPercent": -15.5,
        "bestNetPnl": {"runId": "run_a", "netPnlPaise": 1_250_000},
        "byVersion": [
            {"version": 1, "runsCompleted": 2, "bestReturnPercent": 12.5, "bestRunId": "run_a"}
        ],
    }
    assert body[idle]["runsTotal"] == 0 and body[idle]["lastRunAt"] is None
    assert body[failing]["runsFailed"] == 1 and body[failing]["bestNetPnl"] is None
    for sid in (idle, failing):
        assert body[sid]["bestCagrPercent"] is None and body[sid]["worstCagrPercent"] is None
    assert list(body) == ids


def test_stats_by_version_follow_each_strategy_version(
    client: TestClient, spec: dict[str, object], clean: Engine, parity: Parity
) -> None:
    created = client.post(
        "/api/v1/strategies", json={"name": "Tuned", "description": "", "spec": spec}
    ).json()
    sid = created["id"]
    assert (
        client.post(
            f"/api/v1/strategies/{sid}/versions", json={"spec": spec, "note": "tuned"}
        ).status_code
        == 201
    )
    with Session(clean) as db:
        db.add_all(
            [
                _run("run_x", sid, "completed", 1),
                _run("run_y", sid, "completed", 2),
                _run("run_z", sid, "failed", 3, version=2),
            ]
        )
        db.flush()
        db.add_all(
            [
                _result("run_x", "2", "50", "-1", 20_000),
                _result("run_y", "5", "50", "-1", 50_000),
            ]
        )
        db.commit()

    row = next(r for r in client.get(STATS).json() if r["strategyId"] == sid)

    parity.assert_valid(row, "StrategyStats")
    assert row["byVersion"] == [
        {"version": 1, "runsCompleted": 2, "bestReturnPercent": 5.0, "bestRunId": "run_y"},
        {"version": 2, "runsCompleted": 0, "bestReturnPercent": None, "bestRunId": None},
    ]


def test_stats_can_count_one_data_source_only(
    client: TestClient, spec: dict[str, object], clean: Engine
) -> None:
    """D82 (10): `dataSource=recorded` ignores history runs, and the other way round."""
    sid = client.post(
        "/api/v1/strategies", json={"name": "Both", "description": "", "spec": spec}
    ).json()["id"]
    recorded = _run("run_r", sid, "completed", 1)
    recorded.data_source = "recorded"
    with Session(clean) as db:
        db.add_all([_run("run_h", sid, "completed", 2), recorded])
        db.flush()
        db.add_all(
            [
                _result("run_h", "10", "50", "-5", 1_000_000),
                _result("run_r", "2", "70", "-1", 200_000),
            ]
        )
        db.commit()

    def stats(**params: str) -> dict[str, object]:
        rows = client.get(STATS, params=params).json()
        found: dict[str, object] = next(row for row in rows if row["strategyId"] == sid)
        return found

    assert stats()["runsCompleted"] == 2
    only_recorded = stats(dataSource="recorded")
    assert only_recorded["runsTotal"] == 1 and only_recorded["bestReturnPercent"] == 2.0
    assert only_recorded["bestNetPnl"] == {"runId": "run_r", "netPnlPaise": 200_000}
    assert stats(dataSource="history")["bestReturnPercent"] == 10.0
    assert client.get(STATS, params={"dataSource": "live"}).status_code == 400
