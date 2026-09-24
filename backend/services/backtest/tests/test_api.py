from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from nova_db.models import AuditEntry, BacktestResult, Trade
from nova_testing.parity import Parity
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

BACKTESTS = "/api/v1/backtests"


def _queue(client: TestClient, body: dict[str, object]) -> dict[str, object]:
    response = client.post(BACKTESTS, json=body)
    assert response.status_code == 201, response.text
    queued: dict[str, object] = response.json()
    return queued


def test_queue_a_run(
    client: TestClient, run_body: dict[str, object], parity: Parity, clean: Engine
) -> None:
    run = _queue(client, run_body)

    parity.assert_valid(run, "BacktestRun")
    assert run["status"] == "queued" and run["startedAt"] is None
    assert run["from"] == "2025-01-01" and run["universe"] == run_body["universe"]
    assert client.get(f"{BACKTESTS}/{run['id']}").json() == run
    with Session(clean) as db:
        entry = db.scalars(select(AuditEntry)).one()
    assert entry.action == "backtest.run" and entry.summary == "Queued backtest IT basket"


@pytest.mark.parametrize(
    ("change", "status"),
    [
        ({"strategyId": "stg_nope"}, 404),
        ({"strategyVersion": 9}, 404),
        ({"universe": {"type": "symbols", "symbols": ["NOPE"]}}, 400),
        ({"from": "2026-01-01"}, 400),
        ({"initialCapitalPaise": 0}, 400),
    ],
)
def test_bad_run_requests(
    client: TestClient, run_body: dict[str, object], change: dict[str, object], status: int
) -> None:
    assert client.post(BACKTESTS, json=run_body | change).status_code == status


def test_list_is_paged_newest_first_and_filters_by_strategy(
    client: TestClient, run_body: dict[str, object]
) -> None:
    ids = [_queue(client, run_body | {"name": f"Run {i}"})["id"] for i in range(3)]

    first = client.get(BACKTESTS, params={"limit": 2}).json()
    rest = client.get(BACKTESTS, params={"limit": 2, "cursor": first["nextCursor"]}).json()

    assert [r["id"] for r in first["items"] + rest["items"]] == list(reversed(ids))
    assert rest["nextCursor"] is None
    other = client.get(BACKTESTS, params={"strategyId": "stg_other"}).json()
    assert other == {"items": [], "nextCursor": None}


def test_result_and_trades(
    client: TestClient,
    run_body: dict[str, object],
    clean: Engine,
    parity: Parity,
) -> None:
    run_id = str(_queue(client, run_body)["id"])
    assert client.get(f"{BACKTESTS}/{run_id}/result").status_code == 404

    base = datetime(2025, 1, 2, 4, tzinfo=UTC)
    with Session(clean) as db:
        db.add(
            BacktestResult(
                run_id=run_id,
                gross_pnl_paise=1_000,
                charges_paise=300,
                net_pnl_paise=700,
                return_percent=Decimal("0.007"),
                cagr_percent=Decimal("0.014"),
                max_drawdown_percent=Decimal("-0.5"),
                sharpe=Decimal("0.8"),
                win_rate_percent=Decimal("50"),
                trade_count=3,
                win_count=1,
                loss_count=1,
                equity_curve=[
                    {"date": "2025-01-02", "equityPaise": 10_000_700, "benchmarkPaise": None}
                ],
                by_symbol=[
                    {
                        "symbol": "INFY",
                        "tradeCount": 3,
                        "winCount": 1,
                        "lossCount": 1,
                        "winRatePercent": 33.33,
                        "netPnlPaise": 700,
                    }
                ],
            )
        )
        for i in range(3):
            db.add(
                Trade(
                    id=f"trd_{i}",
                    run_id=run_id,
                    symbol="INFY",
                    exchange="NSE",
                    segment="equity_delivery",
                    side="buy",
                    qty=1,
                    entry_at=base + timedelta(days=i),
                    entry_price_paise=150_000,
                    exit_at=base + timedelta(days=i + 1),
                    exit_price_paise=150_100,
                    gross_pnl_paise=100,
                    brokerage_paise=0,
                    stt_paise=0,
                    exchange_txn_paise=0,
                    sebi_fee_paise=0,
                    stamp_duty_paise=0,
                    gst_paise=0,
                    dp_paise=0,
                    charges_total_paise=0,
                    net_pnl_paise=100,
                )
            )
        db.commit()

    result = client.get(f"{BACKTESTS}/{run_id}/result").json()
    parity.assert_valid(result, "BacktestResult")
    assert result["metrics"]["netPnlPaise"] == 700

    first = client.get(f"{BACKTESTS}/{run_id}/trades", params={"limit": 2}).json()
    rest = client.get(
        f"{BACKTESTS}/{run_id}/trades", params={"limit": 2, "cursor": first["nextCursor"]}
    ).json()
    for trade in first["items"]:
        parity.assert_valid(trade, "Trade")
    assert [t["id"] for t in first["items"] + rest["items"]] == ["trd_0", "trd_1", "trd_2"]


def test_unknown_run_is_not_found(client: TestClient) -> None:
    for path in ("", "/result", "/trades"):
        assert client.get(f"{BACKTESTS}/run_nope{path}").status_code == 404
