"""The visual engine through the worker, on seeded candles and Zerodha rates (D42, D45, D46)."""

import threading
from datetime import date, datetime, time, timedelta

import pytest
from fastapi.testclient import TestClient
from nova_backtest.bars import IST
from nova_backtest.visual import VisualEngine
from nova_backtest.worker import run_worker
from nova_db.models import BacktestRun, Candle, StrategyVersion
from nova_testing.parity import Parity
from sqlalchemy import Engine, update
from sqlalchemy.orm import Session, sessionmaker

RULE = {"left": {"kind": "price", "field": "close"}, "right": {"kind": "number", "value": 0}}


def _spec(**change: object) -> dict[str, object]:
    spec: dict[str, object] = {
        "mode": "visual",
        "segment": "equity_delivery",
        "exchange": "NSE",
        "timeframe": "1d",
        "sizing": {"type": "fixed_qty", "qty": 10},
        "risk": {"stopLossPercent": None, "targetPercent": None},
        "entry": {
            "combinator": "all",
            "conditions": [RULE | {"op": "gt", "right": {"kind": "number", "value": 105}}],
        },
        "exit": {
            "combinator": "all",
            "conditions": [RULE | {"op": "lt", "right": {"kind": "number", "value": 100}}],
        },
    }
    return spec | change


# Rupee OHLC per day from 2025-01-01; INFY trades once (buy 107, sell 98), TCS never signals.
INFY = [
    (100, 101, 99, 100),
    (104, 107, 103, 106),
    (107, 108, 106, 107),
    (105, 106, 98, 99),
    (98, 99, 97, 98),
]
TCS = [(50, 51, 49, 50)] * 5


@pytest.fixture
def seeded(clean: Engine) -> Engine:
    with Session(clean) as db:
        db.add(StrategyVersion(strategy_id="stg_1", version=2, spec=_spec()))
        db.execute(
            update(StrategyVersion).where(StrategyVersion.version == 1).values(note="intraday")
        )
        for symbol, days in (("INFY", INFY), ("TCS", TCS)):
            for i, (o, h, low, c) in enumerate(days):
                ts = datetime.combine(date(2025, 1, 1) + timedelta(days=i), time(0), tzinfo=IST)
                db.add(
                    Candle(
                        exchange="NSE",
                        symbol=symbol,
                        timeframe="1d",
                        ts=ts,
                        open_paise=o * 100,
                        high_paise=h * 100,
                        low_paise=low * 100,
                        close_paise=c * 100,
                        volume=1_000,
                    )
                )
        db.commit()
    return clean


def _queue(engine: Engine, version: int = 2, symbols: tuple[str, ...] = ("INFY", "TCS")) -> str:
    with Session(engine) as db:
        db.add(
            BacktestRun(
                id="run_e2e",
                strategy_id="stg_1",
                strategy_version=version,
                name="E2E",
                universe={"type": "symbols", "symbols": list(symbols)},
                status="queued",
                date_from=date(2025, 1, 1),
                date_to=date(2025, 1, 5),
                initial_capital_paise=10_000_000,
                benchmark=None,
            )
        )
        db.commit()
    return "run_e2e"


def _drain(factory: sessionmaker[Session]) -> BacktestRun:
    stop = threading.Event()
    run_worker(factory, VisualEngine(), stop, poll_seconds=0, on_idle=stop.set)
    with factory() as db:
        run = db.get(BacktestRun, "run_e2e")
        assert run is not None
        return run


def test_a_delivery_run_completes_with_charges(
    seeded: Engine, factory: sessionmaker[Session], client: TestClient, parity: Parity
) -> None:
    _queue(seeded)

    run = _drain(factory)

    assert run.status == "completed" and run.error is None
    result = client.get("/api/v1/backtests/run_e2e/result").json()
    parity.assert_valid(result, "BacktestResult")
    trades = client.get("/api/v1/backtests/run_e2e/trades").json()["items"]
    for trade in trades:
        parity.assert_valid(trade, "Trade")
    (trade,) = trades
    assert (trade["symbol"], trade["qty"], trade["entryPricePaise"], trade["exitPricePaise"]) == (
        "INFY",
        10,
        10_700,
        9_800,
    )
    # Delivery charges on ₹1,070 buy + ₹980 sell (rates from 2024-10-01): STT ₹2.05 → ₹2,
    # txn 6.09 p, SEBI 0.21 p, stamp 16.05 p, DP ₹13, GST 18% × 1,306.3 p.
    assert trade["charges"]["dpPaise"] == 1_300 and trade["charges"]["sttPaise"] == 200
    assert trade["netPnlPaise"] == -9_000 - trade["charges"]["totalPaise"]
    metrics = result["metrics"]
    assert metrics["tradeCount"] == 1 and metrics["lossCount"] == 1
    assert metrics["netPnlPaise"] == trade["netPnlPaise"]
    assert result["equityCurve"][-1]["equityPaise"] == 10_000_000 + trade["netPnlPaise"]
    assert [row["symbol"] for row in result["bySymbol"]] == ["INFY", "TCS"]


def test_rerun_replaces_the_old_result(seeded: Engine, factory: sessionmaker[Session]) -> None:
    _queue(seeded)
    _drain(factory)
    with Session(seeded) as db:
        db.execute(update(BacktestRun).values(status="queued"))
        db.commit()

    assert _drain(factory).status == "completed"  # no duplicate trades or result rows


@pytest.mark.parametrize(
    ("spec", "message"),
    [
        (_spec(mode="python", code="x"), "Python strategies arrive in NOVA-057"),
        (_spec(segment="equity_intraday"), "Intraday strategies need an intraday timeframe"),
        (_spec(timeframe="5m"), "No 5m candles in the period for INFY, TCS"),
    ],
)
def test_runs_the_engine_cannot_do_fail_plainly(
    seeded: Engine, factory: sessionmaker[Session], spec: dict[str, object], message: str
) -> None:
    if spec.get("mode") == "python":
        spec.pop("entry")
        spec.pop("exit")
    with Session(seeded) as db:
        db.execute(update(StrategyVersion).where(StrategyVersion.version == 2).values(spec=spec))
        db.commit()
    _queue(seeded)

    run = _drain(factory)

    assert run.status == "failed" and run.error is not None and run.error.startswith(message)


def test_an_intraday_run_squares_off_and_pays_intraday_charges(
    seeded: Engine, factory: sessionmaker[Session], client: TestClient, parity: Parity
) -> None:
    clocks = [(15, 5), (15, 10), (15, 15), (15, 20), (15, 25)]
    prices = [
        (104, 106, 103, 106),
        (106, 107, 105, 106),
        (106, 106, 106, 106),
        (103, 104, 102, 103),
    ]
    prices.append((104, 104, 104, 104))
    with Session(seeded) as db:
        for (hour, minute), (o, h, low, c) in zip(clocks, prices, strict=True):
            db.add(
                Candle(
                    exchange="NSE",
                    symbol="INFY",
                    timeframe="5m",
                    ts=datetime(2025, 1, 2, hour, minute, tzinfo=IST),
                    open_paise=o * 100,
                    high_paise=h * 100,
                    low_paise=low * 100,
                    close_paise=c * 100,
                    volume=1_000,
                )
            )
        spec = _spec(segment="equity_intraday", timeframe="5m")
        db.execute(update(StrategyVersion).where(StrategyVersion.version == 2).values(spec=spec))
        db.commit()
    _queue(seeded, symbols=("INFY",))

    assert _drain(factory).status == "completed"
    (trade,) = client.get("/api/v1/backtests/run_e2e/trades").json()["items"]
    parity.assert_valid(trade, "Trade")
    assert trade["segment"] == "equity_intraday"
    assert (trade["entryPricePaise"], trade["exitPricePaise"]) == (10_600, 10_300)
    assert trade["exitAt"] == "2025-01-02T09:50:00Z"  # 15:20 IST
    # Intraday: brokerage 0.03% per order (₹0.318 + ₹0.309), no DP, STT 0.025% on ₹1,030 → ₹0.
    assert trade["charges"]["dpPaise"] == 0 and trade["charges"]["brokeragePaise"] == 63
