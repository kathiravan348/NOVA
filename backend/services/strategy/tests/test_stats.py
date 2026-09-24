from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient
from nova_db.models import BacktestResult, BacktestRun
from nova_testing.parity import Parity
from sqlalchemy import Engine
from sqlalchemy.orm import Session

STATS = "/api/v1/strategies/stats"
T0 = datetime(2026, 9, 1, tzinfo=UTC)


def _run(run_id: str, strategy_id: str, status: str, minutes: int) -> BacktestRun:
    return BacktestRun(
        id=run_id,
        strategy_id=strategy_id,
        strategy_version=1,
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


def _result(run_id: str, ret: str, win: str, drawdown: str, net: int) -> BacktestResult:
    return BacktestResult(
        run_id=run_id,
        gross_pnl_paise=net + 100,
        charges_paise=100,
        net_pnl_paise=net,
        return_percent=Decimal(ret),
        cagr_percent=Decimal("1"),
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
    with Session(clean) as db:
        db.add_all(
            [
                _run("run_a", busy, "completed", 1),
                _run("run_b", busy, "completed", 2),
                _run("run_c", busy, "running", 3),
                _run("run_d", busy, "queued", 4),
                _run("run_e", failing, "failed", 5),
            ]
        )
        db.flush()
        db.add_all(
            [
                _result("run_a", "12.5", "60", "-8.25", 1_250_000),
                _result("run_b", "-3.1", "40", "-15.5", -310_000),
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
        "winRateMinPercent": 40.0,
        "winRateMaxPercent": 60.0,
        "worstDrawdownPercent": -15.5,
        "bestNetPnl": {"runId": "run_a", "netPnlPaise": 1_250_000},
    }
    assert body[idle]["runsTotal"] == 0 and body[idle]["lastRunAt"] is None
    assert body[failing]["runsFailed"] == 1 and body[failing]["bestNetPnl"] is None
    assert list(body) == ids
