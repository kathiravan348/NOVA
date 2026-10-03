from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from nova_db.models import AuditEntry, BacktestResult, BacktestRun, StrategyVersion, Trade
from nova_testing.parity import Parity
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session


def _seed_ledger(client: TestClient, body: dict[str, object], engine: Engine) -> str:
    run_id = str(_queue(client, body)["id"])
    with Session(engine) as db:
        run = db.get(BacktestRun, run_id)
        assert run is not None
        run.status = "completed"
        run.stage, run.progress_percent = "done", 100
        initial = run.initial_capital_paise
        db.add(
            BacktestResult(
                run_id=run_id,
                gross_pnl_paise=200,
                charges_paise=20,
                net_pnl_paise=180,
                return_percent=Decimal("0.0018"),
                cagr_percent=Decimal("0.1"),
                max_drawdown_percent=Decimal(0),
                sharpe=Decimal(0),
                win_rate_percent=Decimal(100),
                trade_count=2,
                win_count=2,
                loss_count=0,
                by_symbol=[],
                equity_curve=[
                    {
                        "date": f"2025-01-0{day}",
                        "equityPaise": initial + profit,
                        "benchmarkPaise": None,
                    }
                    for day, profit in [(2, 0), (3, 100), (4, 180), (5, 180)]
                ],
            )
        )
        for symbol, day, price in [("INFY", 2, 1000), ("TCS", 3, 500)]:
            db.add(
                Trade(
                    id=f"trd_ledger_{symbol}",
                    run_id=run_id,
                    symbol=symbol,
                    exchange="NSE",
                    segment="equity_delivery",
                    side="buy",
                    qty=1,
                    entry_at=datetime(2025, 1, day, 4, tzinfo=UTC),
                    entry_price_paise=price,
                    exit_at=datetime(2025, 1, 4, 5, tzinfo=UTC),
                    exit_price_paise=price + 100,
                    exit_reason="target",
                    gross_pnl_paise=100,
                    brokerage_paise=10,
                    stt_paise=0,
                    exchange_txn_paise=0,
                    sebi_fee_paise=0,
                    stamp_duty_paise=0,
                    gst_paise=0,
                    dp_paise=0,
                    charges_total_paise=10,
                    net_pnl_paise=90,
                )
            )
        db.commit()
    return run_id


def test_ledger_paging_filters_events_and_final_equity(
    client: TestClient,
    run_body: dict[str, object],
    clean: Engine,
    parity: Parity,
) -> None:
    run_id = _seed_ledger(client, run_body, clean)
    path = f"/api/v1/backtests/{run_id}/ledger"
    first = client.get(path, params={"limit": 2}).json()
    rest = client.get(path, params={"offset": 2, "limit": 2}).json()
    parity.assert_valid(first, "LedgerPage")
    assert first["total"] == rest["total"] == 3
    assert [day["date"] for day in first["items"] + rest["items"]] == [
        "2025-01-02",
        "2025-01-03",
        "2025-01-04",
    ]
    final = rest["items"][0]
    assert final["cashPaise"] + final["holdingsPaise"] == 10_000_180
    assert final["cashPaise"] == 10_000_180 and final["openPositions"] == 0
    assert client.get(path, params={"allDays": True}).json()["total"] == 4
    filtered = client.get(
        path, params={"from": "2025-01-03", "to": "2025-01-04", "symbol": "TCS"}
    ).json()
    assert filtered["total"] == 2 and filtered["items"][1]["sells"] == 1
    assert filtered["items"][1]["cashPaise"] == final["cashPaise"]
    assert client.get(path, params={"symbol": "NOPE"}).json()["total"] == 0
    events = client.get(f"{path}/2025-01-04").json()
    assert [event["symbol"] for event in events] == ["INFY", "TCS"]
    for event in events:
        parity.assert_valid(event, "LedgerEvent")
        assert event["reason"] == "target"
    assert len(client.get(f"{path}/2025-01-04", params={"symbol": "TCS"}).json()) == 1
    assert client.get(f"{path}/2025-01-05").json() == []
    assert client.get(path, params={"from": "2025-01-04", "to": "2025-01-03"}).status_code == 400
    assert client.get(path, params={"offset": -1}).status_code == 400
    assert client.get(f"{path}/bad-date").status_code == 400


def test_timeline_lists_events_oldest_first_with_paging_and_filters(
    client: TestClient,
    run_body: dict[str, object],
    clean: Engine,
    parity: Parity,
) -> None:
    run_id = _seed_ledger(client, run_body, clean)
    path = f"/api/v1/backtests/{run_id}/timeline"
    first = client.get(path, params={"limit": 3}).json()
    rest = client.get(path, params={"offset": 3, "limit": 3}).json()
    parity.assert_valid(first, "LedgerEventPage")
    assert first["total"] == rest["total"] == 4 and first["nextCursor"] is None
    events = first["items"] + rest["items"]
    assert [(event["symbol"], event["side"]) for event in events] == [
        ("INFY", "buy"),
        ("TCS", "buy"),
        ("INFY", "sell"),
        ("TCS", "sell"),
    ]
    assert [event["entryAt"] for event in events] == [
        None,
        None,
        "2025-01-02T04:00:00Z",
        "2025-01-03T04:00:00Z",
    ]
    assert events[-1]["cashAfterPaise"] == 10_000_180
    tcs = client.get(path, params={"symbol": "TCS", "from": "2025-01-04"}).json()
    assert tcs["total"] == 1 and tcs["items"][0]["side"] == "sell"
    assert client.get(path, params={"to": "2025-01-02"}).json()["total"] == 1
    assert client.get(path, params={"symbol": "NOPE"}).json()["total"] == 0
    assert client.get(path, params={"from": "2025-01-04", "to": "2025-01-03"}).status_code == 400
    assert client.get(path, params={"offset": -1}).status_code == 400


@pytest.mark.parametrize("suffix", ["ledger", "ledger/2025-01-02", "timeline"])
def test_ledger_errors(
    client: TestClient, run_body: dict[str, object], clean: Engine, suffix: str
) -> None:
    assert client.get(f"/api/v1/backtests/nope/{suffix}").status_code == 404
    run_id = str(_queue(client, run_body)["id"])
    path = f"/api/v1/backtests/{run_id}/{suffix}"
    assert client.get(path).status_code == 400
    with Session(clean) as db:
        run = db.get(BacktestRun, run_id)
        assert run is not None
        run.report_kept = False
        db.commit()
    response = client.get(path)
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Only the newest version keeps the full report"


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
    assert run["skippedSymbols"] == []
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


def test_benchmark_must_be_a_stored_index(
    client: TestClient, run_body: dict[str, object], parity: Parity
) -> None:
    invalid = client.post(BACKTESTS, json=run_body | {"benchmark": "SENSEX"})
    assert invalid.status_code == 400
    assert invalid.json()["error"]["code"] == "invalid_request"
    assert invalid.json()["error"]["message"] == "Unknown benchmark: SENSEX"
    run = _queue(client, run_body | {"benchmark": "NIFTY 500"})
    assert run["benchmark"] == "NIFTY 500"
    parity.assert_valid(run, "BacktestRun")


def test_list_is_paged_newest_first_and_filters_by_strategy(
    client: TestClient, run_body: dict[str, object]
) -> None:
    ids = [_queue(client, run_body | {"name": f"Run {i}"})["id"] for i in range(3)]

    first = client.get(BACKTESTS, params={"limit": 2}).json()
    rest = client.get(BACKTESTS, params={"limit": 2, "cursor": first["nextCursor"]}).json()

    assert [r["id"] for r in first["items"] + rest["items"]] == list(reversed(ids))
    assert rest["nextCursor"] is None
    offset = client.get(BACKTESTS, params={"limit": 2, "offset": 2}).json()
    assert offset == rest
    assert first["total"] == rest["total"] == 3
    assert (
        client.get(BACKTESTS, params={"offset": 0, "cursor": first["nextCursor"]}).status_code
        == 422
    )
    other = client.get(BACKTESTS, params={"strategyId": "stg_other"}).json()
    assert other == {"items": [], "nextCursor": None, "total": 0}


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
    # A result saved before NOVA-116 (D62 (6)): the new numbers read back as null, years as [].
    assert result["metrics"]["estimatedTaxPaise"] is None
    assert result["metrics"]["benchmarkReturnPercent"] is None and result["years"] == []

    first = client.get(f"{BACKTESTS}/{run_id}/trades", params={"limit": 2}).json()
    rest = client.get(
        f"{BACKTESTS}/{run_id}/trades", params={"limit": 2, "cursor": first["nextCursor"]}
    ).json()
    for trade in first["items"]:
        parity.assert_valid(trade, "Trade")
    assert [t["id"] for t in first["items"] + rest["items"]] == ["trd_0", "trd_1", "trd_2"]
    assert (
        client.get(f"{BACKTESTS}/{run_id}/trades", params={"offset": 2, "limit": 2}).json() == rest
    )
    assert first["total"] == rest["total"] == 3


def test_unknown_run_is_not_found(client: TestClient) -> None:
    for path in ("", "/result", "/trades"):
        assert client.get(f"{BACKTESTS}/run_nope{path}").status_code == 404


REGIME = {
    "index": "NIFTY 50",
    "condition": {
        "left": {"kind": "price", "field": "close"},
        "op": "gt",
        "right": {"kind": "indicator", "name": "sma", "params": {"period": 200}},
    },
    "whenOff": "no_new_entries",
}


def _add_version(engine: Engine, parity: Parity, version: int, **change: object) -> None:
    """Stores `stg_1` version `version`: the first mock spec with `change` applied (D82)."""
    spec = parity.mock("strategies")[0]["versions"][0]["spec"] | change
    with Session(engine) as db:
        db.add(StrategyVersion(strategy_id="stg_1", version=version, spec=spec))
        db.commit()


def test_a_run_without_a_data_source_uses_history(
    client: TestClient, run_body: dict[str, object]
) -> None:
    run = _queue(client, run_body)
    assert run["dataSource"] == "history"
    assert run["recordedDaysUsed"] is None and run["recordedDaysSkipped"] == []


def test_a_recorded_intraday_run_is_queued(
    client: TestClient, run_body: dict[str, object], parity: Parity
) -> None:
    run = _queue(client, run_body | {"dataSource": "recorded"})
    assert run["dataSource"] == "recorded"
    parity.assert_valid(run, "BacktestRun")


@pytest.mark.parametrize(
    ("change", "source", "message"),
    [
        ({"segment": "equity_delivery"}, "recorded", "Recorded data backtests are intraday only"),
        ({"timeframe": "5s"}, "history", "Seconds candles exist only in recorded data"),
        ({"regime": REGIME}, "recorded", "Market filter is not available on recorded data yet"),
    ],
)
def test_source_pairs_the_engine_cannot_run_are_refused(
    client: TestClient,
    run_body: dict[str, object],
    clean: Engine,
    parity: Parity,
    change: dict[str, object],
    source: str,
    message: str,
) -> None:
    _add_version(clean, parity, 2, **change)
    response = client.post(BACKTESTS, json=run_body | {"strategyVersion": 2, "dataSource": source})
    assert response.status_code == 400
    assert response.json()["error"]["message"] == message


def test_a_new_version_keeps_the_data_source_unless_sent(
    client: TestClient, run_body: dict[str, object], clean: Engine, parity: Parity
) -> None:
    _add_version(clean, parity, 2, timeframe="5s")
    first = _queue(client, run_body | {"dataSource": "recorded"})
    with Session(clean) as db:
        run = db.get(BacktestRun, first["id"])
        assert run is not None
        run.status = "completed"
        db.commit()
    body = {k: v for k, v in run_body.items() if k != "strategyId"} | {"strategyVersion": 2}
    kept = client.post(f"{BACKTESTS}/{first['id']}/versions", json=body)
    assert kept.status_code == 201, kept.text
    assert kept.json()["dataSource"] == "recorded"
    with Session(clean) as db:
        run = db.get(BacktestRun, kept.json()["id"])
        assert run is not None
        run.status = "completed"
        db.commit()
    refused = client.post(
        f"{BACKTESTS}/{first['id']}/versions", json=body | {"dataSource": "history"}
    )
    assert refused.status_code == 400
    assert refused.json()["error"]["message"] == "Seconds candles exist only in recorded data"
