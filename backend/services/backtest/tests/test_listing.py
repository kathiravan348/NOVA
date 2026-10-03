"""`GET /backtests` results, filters and sorting (D82 (6))."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from nova_db.models import BacktestResult, BacktestRun, StrategyVersion
from nova_testing.parity import Parity
from sqlalchemy import Engine
from sqlalchemy.orm import Session

BACKTESTS = "/api/v1/backtests"
T0 = datetime(2026, 9, 1, tzinfo=UTC)
# id, name, version, source, net P&L, return, CAGR, drawdown, win rate, trades, profit factor
ROWS = [
    ("run_a", "Alpha IT", 1, "history", 70_000, "7", "14", "-5", "60", 30, "1.8"),
    ("run_b", "Beta banks", 1, "history", -20_000, "-2", "-4", "-12", "40", 12, "0.7"),
    ("run_c", "Gamma recorded", 2, "recorded", 5_000, "0.5", "9", "-1", "55", 80, None),
]


@pytest.fixture
def listed(clean: Engine, parity: Parity) -> Engine:
    """Three completed runs (v2 of stg_1 is a delivery daily spec) and one queued run."""
    delivery = parity.mock("strategies")[0]["versions"][0]["spec"] | {
        "segment": "equity_delivery",
        "timeframe": "1d",
    }
    with Session(clean) as db:
        db.add(StrategyVersion(strategy_id="stg_1", version=2, spec=delivery))
        db.flush()
        for i, (run_id, name, version, source, net, ret, cagr, dd, win, trades, pf) in enumerate(
            ROWS
        ):
            db.add(_run(run_id, name, version, source, "completed", i))
            db.flush()
            db.add(_result(run_id, net, ret, cagr, dd, win, trades, pf))
        db.add(_run("run_q", "Queued later", 1, "history", "queued", 10))
        db.commit()
    return clean


def _run(
    run_id: str, name: str, version: int, source: str, status: str, minutes: int
) -> BacktestRun:
    return BacktestRun(
        id=run_id,
        strategy_id="stg_1",
        strategy_version=version,
        name=name,
        universe={"type": "symbols", "symbols": ["INFY"]},
        status=status,
        date_from=date(2026, 1, 1),
        date_to=date(2026, 6, 30),
        initial_capital_paise=10_000_000,
        benchmark=None,
        created_at=T0 + timedelta(minutes=minutes),
        data_source=source,
        stage="done" if status == "completed" else None,
        progress_percent=100 if status == "completed" else 0,
    )


def _result(
    run_id: str, net: int, ret: str, cagr: str, dd: str, win: str, trades: int, pf: str | None
) -> BacktestResult:
    return BacktestResult(
        run_id=run_id,
        gross_pnl_paise=net + 100,
        charges_paise=100,
        net_pnl_paise=net,
        return_percent=Decimal(ret),
        cagr_percent=Decimal(cagr),
        max_drawdown_percent=Decimal(dd),
        sharpe=Decimal("1.1"),
        win_rate_percent=Decimal(win),
        trade_count=trades,
        win_count=trades // 2,
        loss_count=trades // 2,
        equity_curve=[],
        by_symbol=[],
        profit_factor=None if pf is None else Decimal(pf),
        spread_cost_paise=1_234 if run_id == "run_c" else None,
    )


def ids(client: TestClient, **params: str | int | float) -> list[str]:
    response = client.get(BACKTESTS, params=params)
    assert response.status_code == 200, response.text
    return [item["id"] for item in response.json()["items"]]


def test_items_carry_segment_timeframe_and_summary(
    listed: Engine, client: TestClient, parity: Parity
) -> None:
    page = client.get(BACKTESTS).json()
    by_id = {item["id"]: item for item in page["items"]}
    assert page["total"] == 4
    assert (by_id["run_a"]["segment"], by_id["run_a"]["timeframe"]) == ("equity_intraday", "5m")
    assert (by_id["run_c"]["segment"], by_id["run_c"]["timeframe"]) == ("equity_delivery", "1d")
    assert by_id["run_q"]["summary"] is None
    summary = by_id["run_c"]["summary"]
    assert summary["netPnlPaise"] == 5_000 and summary["spreadCostPaise"] == 1_234
    assert summary["profitFactor"] is None and summary["tradeCount"] == 80
    metrics = client.get(f"{BACKTESTS}/run_a/result").json()["metrics"]
    assert by_id["run_a"]["summary"]["cagrPercent"] == metrics["cagrPercent"]
    for item in page["items"]:
        parity.assert_valid(item, "BacktestRunListItem")


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"dataSource": "recorded"}, ["run_c"]),
        ({"status": "queued"}, ["run_q"]),
        ({"q": "BETA"}, ["run_b"]),
        ({"q": "%"}, []),
        ({"segment": "equity_delivery"}, ["run_c"]),
        ({"timeframe": "5m"}, ["run_q", "run_b", "run_a"]),
        ({"minReturn": 0}, ["run_c", "run_a"]),
        ({"minCagr": 10}, ["run_a"]),
        ({"maxDrawdown": 6}, ["run_c", "run_a"]),
        ({"minWinRate": 55}, ["run_c", "run_a"]),
        ({"minTrades": 31}, ["run_c"]),
        ({"minProfitFactor": 1}, ["run_a"]),
        ({"profitable": "true"}, ["run_c", "run_a"]),
        ({"profitable": "false"}, ["run_b"]),
        ({"minCagr": 0, "dataSource": "history"}, ["run_a"]),
    ],
)
def test_filters(
    listed: Engine, client: TestClient, params: dict[str, str | int | float], expected: list[str]
) -> None:
    assert ids(client, **params) == expected
    assert client.get(BACKTESTS, params=params).json()["total"] == len(expected)


@pytest.mark.parametrize(
    ("sort", "order", "expected"),
    [
        ("created", "desc", ["run_q", "run_c", "run_b", "run_a"]),
        ("created", "asc", ["run_a", "run_b", "run_c", "run_q"]),
        ("cagr", "desc", ["run_a", "run_c", "run_b", "run_q"]),
        ("cagr", "asc", ["run_b", "run_c", "run_a", "run_q"]),
        ("maxDrawdown", "desc", ["run_c", "run_a", "run_b", "run_q"]),
        ("profitFactor", "desc", ["run_a", "run_b", "run_q", "run_c"]),  # no factor: newest first
        ("trades", "desc", ["run_c", "run_a", "run_b", "run_q"]),
        ("netPnl", "asc", ["run_b", "run_c", "run_a", "run_q"]),
    ],
)
def test_sorts_put_runs_without_results_last(
    listed: Engine, client: TestClient, sort: str, order: str, expected: list[str]
) -> None:
    assert ids(client, sort=sort, order=order) == expected


def test_metric_sorts_page_by_offset_and_refuse_a_cursor(
    listed: Engine, client: TestClient
) -> None:
    first = client.get(BACKTESTS, params={"sort": "cagr", "limit": 2}).json()
    assert [i["id"] for i in first["items"]] == ["run_a", "run_c"] and first["nextCursor"] is None
    assert ids(client, sort="cagr", limit=2, offset=2) == ["run_b", "run_q"]
    newest = client.get(BACKTESTS, params={"limit": 2}).json()
    assert newest["nextCursor"] is not None
    refused = client.get(BACKTESTS, params={"sort": "cagr", "cursor": newest["nextCursor"]})
    assert refused.status_code == 400
    assert refused.json()["error"]["message"] == "A results sort pages by offset, not cursor"


@pytest.mark.parametrize(
    "params",
    [{"sort": "name"}, {"minWinRate": 101}, {"maxDrawdown": -1}, {"dataSource": "live"}],
)
def test_bad_values_are_refused(
    listed: Engine, client: TestClient, params: dict[str, str | int | float]
) -> None:
    assert client.get(BACKTESTS, params=params).status_code == 400
