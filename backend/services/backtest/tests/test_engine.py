"""The visual engine through the worker, on seeded candles and Zerodha rates (D42, D45, D46)."""

import itertools
import threading
from datetime import date, datetime, time, timedelta

import pytest
from fastapi.testclient import TestClient
from nova_backtest.bars import IST
from nova_backtest.progress import Progress
from nova_backtest.strategy_engine import StrategyEngine
from nova_backtest.worker import run_one, run_worker
from nova_db.models import BacktestRun, Candle, Instrument, StrategyVersion
from nova_db.queue import claim_next
from nova_testing.parity import Parity
from sqlalchemy import Engine, create_engine, delete, select, update
from sqlalchemy.orm import Session, sessionmaker

RULE = {"left": {"kind": "price", "field": "close"}, "right": {"kind": "number", "value": 0}}
NIFTY_UP = {
    "index": "NIFTY 50",
    "condition": RULE | {"op": "gt"},
    "whenOff": "no_new_entries",
}


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


def _queue(
    engine: Engine,
    version: int = 2,
    symbols: tuple[str, ...] = ("INFY", "TCS"),
    benchmark: str | None = None,
) -> str:
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
                benchmark=benchmark,
            )
        )
        db.commit()
    return "run_e2e"


def _drain(
    factory: sessionmaker[Session], max_bars: int = 1_500_000, max_bars_python: int = 750_000
) -> BacktestRun:
    stop = threading.Event()
    engine = StrategyEngine(max_bars, max_bars_python)
    run_worker(factory, engine, stop, poll_seconds=0, on_idle=stop.set)
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


def test_d62_exits_and_a_ranked_portfolio_run(
    seeded: Engine, factory: sessionmaker[Session], client: TestClient
) -> None:
    """NOVA-115: every new setting runs; the bars-held exit fills at the open before the stops."""
    risk = {
        "stopLossPercent": None,
        "targetPercent": None,
        "trailingStopPercent": 20,
        "atrStop": {"period": 2, "multiplier": 3},
        "maxHoldBars": 1,
    }
    rank = {"by": {"kind": "price", "field": "close", "multiplier": 2}, "order": "desc"}
    spec = _spec(risk=risk, portfolio={"maxPositions": 1, "rank": rank})
    with Session(seeded) as db:
        db.execute(update(StrategyVersion).where(StrategyVersion.version == 2).values(spec=spec))
        db.commit()
    _queue(seeded)

    run = _drain(factory)

    assert run.status == "completed", run.error
    (trade,) = client.get("/api/v1/backtests/run_e2e/trades").json()["items"]
    assert (trade["entryPricePaise"], trade["exitPricePaise"]) == (10_700, 10_500)


def test_new_results_carry_the_d62_numbers_and_a_benchmark(
    seeded: Engine, factory: sessionmaker[Session], client: TestClient, parity: Parity
) -> None:
    """NOVA-116: no index candles → null benchmark, the run completes; with them it starts at
    the initial capital."""
    _queue(seeded, benchmark="NIFTY 50")

    assert _drain(factory).status == "completed"
    result = client.get("/api/v1/backtests/run_e2e/result").json()
    parity.assert_valid(result, "BacktestResult")
    assert {p["benchmarkPaise"] for p in result["equityCurve"]} == {None}
    m = result["metrics"]
    assert m["benchmarkReturnPercent"] is None and m["exposurePercent"] > 0
    assert m["afterTaxNetPnlPaise"] == m["netPnlPaise"] - m["estimatedTaxPaise"]
    (year,) = result["years"]
    assert (year["year"], year["profitPaise"]) == (1, m["netPnlPaise"])

    with Session(seeded) as db:
        for i, close in enumerate((20_000, 20_200, 19_800, 20_400, 21_000)):
            ts = datetime.combine(date(2025, 1, 1) + timedelta(days=i), time(0), tzinfo=IST)
            paise = close * 100
            db.add(
                Candle(
                    exchange="NSE",
                    symbol="NIFTY 50",
                    timeframe="1d",
                    ts=ts,
                    open_paise=paise,
                    high_paise=paise,
                    low_paise=paise,
                    close_paise=paise,
                    volume=0,
                )
            )
        db.execute(update(BacktestRun).values(status="queued"))
        db.commit()
    _drain(factory)
    result = client.get("/api/v1/backtests/run_e2e/result").json()
    curve = [p["benchmarkPaise"] for p in result["equityCurve"]]
    assert curve[0] == 10_000_000 and curve[-1] == 10_500_000
    assert result["metrics"]["benchmarkReturnPercent"] == 5.0
    assert result["years"][0]["benchmarkPercent"] == 5.0


def test_a_run_over_the_bar_limit_fails_early(
    seeded: Engine, factory: sessionmaker[Session], client: TestClient
) -> None:
    _queue(seeded)

    run = _drain(factory, max_bars=9)  # INFY 5 + TCS 5 bars

    assert run.status == "failed"
    assert run.error == (
        "This run needs more than 9 price bars (stopped at TCS). "
        "Pick fewer stocks or a shorter period."
    )
    assert client.get("/api/v1/backtests/run_e2e/trades").json()["items"] == []
    assert client.get("/api/v1/backtests/run_e2e/result").status_code == 404


def test_a_run_at_the_bar_limit_completes(seeded: Engine, factory: sessionmaker[Session]) -> None:
    _queue(seeded)
    assert _drain(factory, max_bars=10, max_bars_python=1).status == "completed"


@pytest.mark.parametrize("all_missing", [False, True])
def test_index_runs_skip_members_without_prices(
    seeded: Engine,
    client: TestClient,
    parity: Parity,
    all_missing: bool,
) -> None:
    _queue(seeded, benchmark="NIFTY 50")  # the benchmark query used to autoflush the run row
    with Session(seeded) as db:
        db.execute(update(Instrument).values(indices=[]))
        db.execute(
            update(Instrument)
            .where(Instrument.symbol.in_(["INFY", "TCS"]))
            .values(indices=["NIFTY 100"])
        )
        assert set(
            db.scalars(select(Instrument.symbol).where(Instrument.symbol.in_(["INFY", "TCS"])))
        ) == {"INFY", "TCS"}
        db.execute(update(BacktestRun).values(universe={"type": "index", "index": "NIFTY 100"}))
        # Warm-up bars alone do not count as prices in the run's period.
        db.execute(
            update(Candle).where(Candle.symbol == "TCS").values(ts=Candle.ts - timedelta(days=10))
        )
        if all_missing:
            db.execute(delete(Candle).where(Candle.symbol == "INFY"))
        db.commit()

    # NOVA-137: the engine's row lock made the progress write wait for ever; fail fast instead.
    strict = create_engine(seeded.url, connect_args={"options": "-c lock_timeout=5000"})
    try:
        run = _drain(sessionmaker(bind=strict, expire_on_commit=False))
    finally:
        strict.dispose()
    wire = client.get("/api/v1/backtests/run_e2e").json()
    parity.assert_valid(wire, "BacktestRun")
    if all_missing:
        assert run.status == "failed"
        assert run.error == (
            "No stock in NIFTY 100 has 1d prices in the period (download them first)"
        )
        assert client.get("/api/v1/backtests/run_e2e/result").status_code == 404
    else:
        assert run.status == "completed", run.error
        assert run.skipped_symbols == wire["skippedSymbols"] == ["TCS"]
        assert wire["progress"]["barsTotal"] == 5
        result = client.get("/api/v1/backtests/run_e2e/result").json()
        assert [row["symbol"] for row in result["bySymbol"]] == ["INFY"]


def test_chosen_symbols_still_fail_when_one_has_no_prices(
    seeded: Engine, factory: sessionmaker[Session]
) -> None:
    _queue(seeded)
    with Session(seeded) as db:
        db.execute(delete(Candle).where(Candle.symbol == "TCS"))
        db.commit()

    run = _drain(factory)

    assert run.status == "failed"
    assert run.error == "No 1d candles in the period for TCS (download them first)"


def test_python_runs_have_their_own_bar_limit(
    seeded: Engine, factory: sessionmaker[Session]
) -> None:
    code = "class Strategy:\n    def on_bar(self, ctx):\n        return None\n"
    spec = _spec(mode="python", code=code)
    spec.pop("entry")
    spec.pop("exit")
    with Session(seeded) as db:
        db.execute(update(StrategyVersion).where(StrategyVersion.version == 2).values(spec=spec))
        db.commit()
    _queue(seeded)

    run = _drain(factory, max_bars=10, max_bars_python=4)

    assert run.error is not None and run.error.startswith("This run needs more than 4 price bars")


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
        (_spec(mode="python", code="import os"), "Python strategy not allowed: imports"),
        (_spec(segment="equity_intraday"), "Intraday strategies need an intraday timeframe"),
        (_spec(timeframe="5m"), "No 5m candles in the period for INFY, TCS"),
        (
            _spec(portfolio={"maxPositions": 3}, regime=NIFTY_UP),
            "No NIFTY 50 1d prices for this period: download them in Relay",
        ),
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


def test_a_recorded_run_reads_ticks_not_candles(
    seeded: Engine, factory: sessionmaker[Session]
) -> None:
    """The seeded Kite candles are never mixed in: with no recorded day the run fails (D82)."""
    _queue(seeded)
    with Session(seeded) as db:
        spec = _spec(segment="equity_intraday", timeframe="1m")
        db.execute(update(StrategyVersion).where(StrategyVersion.version == 2).values(spec=spec))
        db.execute(update(BacktestRun).values(data_source="recorded"))
        db.commit()

    run = _drain(factory)

    assert run.status == "failed" and run.error == "No usable recorded days in this period"


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
    with Session(seeded) as db:  # only 1m bars: the 5m strategy reads them rolled up (D58)
        for (hour, minute), (o, h, low, c) in zip(clocks, prices, strict=True):
            for step in range(5):
                db.add(
                    Candle(
                        exchange="NSE",
                        symbol="INFY",
                        timeframe="1m",
                        ts=datetime(2025, 1, 2, hour, minute + step, tzinfo=IST),
                        open_paise=o * 100,
                        high_paise=h * 100,
                        low_paise=low * 100,
                        close_paise=c * 100,
                        volume=200,
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


class Recording(Progress):
    """Keeps every write: (stage, percent, symbols done/total, bars done/total, trades)."""

    def __init__(self, factory: sessionmaker[Session], run_id: str) -> None:
        ticks = itertools.count(step=2)  # every advance is a second later: every call writes
        super().__init__(factory, run_id, clock=lambda: float(next(ticks)))
        self.writes: list[tuple[object, ...]] = []

    def _write(self) -> None:
        super()._write()
        v = self.values
        self.writes.append(
            (self._stage, self.percent, v["symbols_done"], v["symbols_total"], v["bars_done"])
            + (v["bars_total"], v["trades_so_far"])
        )


def _run_recorded(factory: sessionmaker[Session], engine: StrategyEngine) -> Recording:
    with factory() as db:
        run_id = claim_next(db, BacktestRun)
        assert run_id is not None
        recording = Recording(factory, run_id)
        engine.run(db, run_id, recording)
    return recording


def _add_wipro(engine: Engine) -> None:
    with Session(engine) as db:
        for i in range(5):
            ts = datetime.combine(date(2025, 1, 1) + timedelta(days=i), time(0), tzinfo=IST)
            db.add(
                Candle(
                    exchange="NSE",
                    symbol="WIPRO",
                    timeframe="1d",
                    ts=ts,
                    open_paise=3_000,
                    high_paise=3_100,
                    low_paise=2_900,
                    close_paise=3_000,
                    volume=10,
                )
            )
        db.commit()


def test_a_run_reports_loading_simulating_and_done(
    seeded: Engine, factory: sessionmaker[Session], client: TestClient, parity: Parity
) -> None:
    _add_wipro(seeded)
    _queue(seeded, symbols=("INFY", "TCS", "WIPRO"))

    writes = _run_recorded(factory, StrategyEngine()).writes

    assert writes[0] == ("loading", 0, 0, 3, 0, 0, 0)
    assert ("loading", 30, 3, 3, 0, 0, 0) in writes
    assert "signals" not in [w[0] for w in writes]  # visual rules need no Python step
    simulating = [w for w in writes if w[0] == "simulating"]
    assert simulating[0][4:6] == (0, 15) and simulating[-1] == ("simulating", 95, 3, 3, 15, 15, 1)
    assert writes[-1] == ("saving", 95, 3, 3, 15, 15, 1)
    run = client.get("/api/v1/backtests/run_e2e").json()
    parity.assert_valid(run, "BacktestRun")
    assert run["status"] == "completed"
    assert run["progress"] == {
        "stage": "done",
        "percent": 100,
        "symbolsDone": 3,
        "symbolsTotal": 3,
        "barsDone": 15,
        "barsTotal": 15,
        "tradesSoFar": 1,
        "simulatedTo": "2025-01-05",
    }


def test_a_python_run_passes_through_signals(
    seeded: Engine, factory: sessionmaker[Session]
) -> None:
    code = "class Strategy:\n    def on_bar(self, ctx):\n        return None\n"
    spec = _spec(mode="python", code=code)
    spec.pop("entry")
    spec.pop("exit")
    with Session(seeded) as db:
        db.execute(update(StrategyVersion).where(StrategyVersion.version == 2).values(spec=spec))
        db.commit()
    _queue(seeded)

    stages = [w[:2] for w in _run_recorded(factory, StrategyEngine()).writes]

    assert ("signals", 0) in stages and ("signals", 30) in stages  # stocks done (D61 (5))
    assert stages.index(("signals", 30)) < stages.index(("simulating", 30))


def test_a_failed_run_keeps_its_last_progress(
    seeded: Engine, factory: sessionmaker[Session], client: TestClient
) -> None:
    _queue(seeded)

    with factory() as db:
        run_id = claim_next(db, BacktestRun)
        assert run_id is not None
        run_one(db, run_id, StrategyEngine(max_bars=7), Recording(factory, run_id))  # fails at TCS

    run = client.get("/api/v1/backtests/run_e2e").json()
    assert run["status"] == "failed"
    progress = run["progress"]
    assert (progress["stage"], progress["percent"], progress["symbolsDone"]) == ("loading", 15, 1)
