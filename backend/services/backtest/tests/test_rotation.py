"""NOVA-117 (D62 (4)): rotation rebalances, ranking, keep-within, equal money, filter, regime."""

import threading
from datetime import date, datetime, time, timedelta

import numpy as np
from fastapi.testclient import TestClient
from nova_backtest.bars import IST, Bar
from nova_backtest.columns import Columns
from nova_backtest.rotation import simulate_rotation
from nova_backtest.scratch import MemoryStore
from nova_backtest.simulate import Simulation, WhenOff
from nova_backtest.strategy_engine import StrategyEngine
from nova_backtest.worker import run_worker
from nova_contracts import Charges
from nova_contracts.strategy import Risk, Rotation
from nova_db.models import BacktestRun, Candle, StrategyVersion
from nova_testing.parity import Parity
from sqlalchemy import Engine, insert
from sqlalchemy.orm import Session, sessionmaker

ZERO = Charges(
    brokerage_paise=0,
    stt_paise=0,
    exchange_txn_paise=0,
    sebi_fee_paise=0,
    stamp_duty_paise=0,
    gst_paise=0,
    dp_paise=0,
    total_paise=0,
)
NO_RISK = Risk(stop_loss_percent=None, target_percent=None)
START = date(2025, 1, 1)


def _weekdays(first: date, last: date) -> list[date]:
    days = [first + timedelta(days=k) for k in range((last - first).days + 1)]
    return [d for d in days if d.weekday() < 5]


def _rotation(rebalance: str = "monthly", hold: int = 2, keep: int = 3) -> Rotation:
    return Rotation.model_validate(
        {
            "rebalance": rebalance,
            "hold": hold,
            "keepWithin": keep,
            "score": [{"operand": {"kind": "price", "field": "close"}, "weight": 1}],
        }
    )


def _run(
    days: list[date],
    scores: dict[str, list[float]],
    rotation: Rotation,
    eligible: dict[str, list[bool]] | None = None,
    regime: list[bool] | None = None,
    when_off: WhenOff | None = None,
) -> Simulation:
    """Flat ₹100 prices; each stock's score and filter per day are given directly."""
    store = MemoryStore()
    for symbol, values in scores.items():
        bars = [
            Bar(datetime.combine(d, time(0), tzinfo=IST), 10_000, 10_000, 10_000, 10_000, 1)
            for d in days
        ]
        passes = eligible[symbol] if eligible else [True] * len(days)
        store.add(
            symbol,
            Columns.from_bars(bars),
            np.array(passes, dtype=np.bool_),
            np.zeros(len(days), dtype=np.bool_),
            np.array(values, dtype=np.float64),
            None,
            None if regime is None else np.array(regime, dtype=np.bool_),
        )
    start = datetime.combine(START, time(0), tzinfo=IST)
    return simulate_rotation(store, rotation, NO_RISK, 1_000_000, start, lambda *_: ZERO, when_off)


def _moves(result: Simulation, last: date) -> list[tuple[str, str, date]]:
    """(symbol, "buy"/"sell", IST date), leaving out the closing sale on the last day."""
    moves = [(t.symbol, "buy", t.entry_at.astimezone(IST).date()) for t in result.trades]
    moves += [
        (t.symbol, "sell", t.exit_at.astimezone(IST).date())
        for t in result.trades
        if t.exit_at.astimezone(IST).date() != last
    ]
    return sorted(moves, key=lambda m: (m[2], m[1], m[0]))


def test_monthly_rotation_keeps_rank_3_sells_rank_4_and_splits_money_equally() -> None:
    days = _weekdays(date(2024, 12, 2), date(2025, 3, 31))
    jan = [d < date(2025, 1, 31) for d in days]  # scores before 31 Jan
    feb = [date(2025, 1, 31) <= d < date(2025, 2, 28) for d in days]

    def by_period(january: float, february: float, march: float) -> list[float]:
        return [january if j else february if f else march for j, f in zip(jan, feb, strict=True)]

    scores = {
        "A": by_period(6, 4, 0.5),
        "B": by_period(5, 3.5, 0),
        "C": by_period(4, 6, 1),
        "D": by_period(3, 5, 8),
        "E": by_period(2, 3, 9),
        "F": by_period(1, 1, 10),
    }
    eligible = {s: [not (s == "F" and d >= date(2025, 2, 28)) for d in days] for s in scores}

    result = _run(days, scores, _rotation(), eligible)

    assert _moves(result, days[-1]) == [
        ("A", "buy", date(2025, 1, 1)),  # ranks 1 and 2 on 31 Dec
        ("B", "buy", date(2025, 1, 1)),
        ("C", "buy", date(2025, 2, 3)),  # first bar of February
        ("B", "sell", date(2025, 2, 3)),  # rank 4 > keep 3; A at rank 3 stays
        ("E", "buy", date(2025, 3, 3)),  # F ranks first but fails the filter
        ("A", "sell", date(2025, 3, 3)),  # rank 4 (C is 3rd and stays)
    ]
    assert {t.qty for t in result.trades} == {50}  # ₹10,000 ÷ 2 at ₹100 each time


def _flip(days: list[date]) -> dict[str, list[float]]:
    """A and B swap first place every bar, so each rebalance changes the holding."""
    return {
        "A": [float(k % 2) for k in range(len(days))],
        "B": [float(1 - k % 2) for k in range(len(days))],
    }


def test_weekly_and_quarterly_rebalance_on_the_right_bars() -> None:
    days = _weekdays(date(2024, 12, 2), date(2025, 2, 28))
    weekly = _run(days, _flip(days), _rotation("weekly", 1, 1))
    mondays = {d for d in days if d.weekday() == 0 and d >= START}
    assert {m[2] for m in _moves(weekly, days[-1])} == {START} | mondays

    days = _weekdays(date(2024, 12, 2), date(2025, 9, 30))
    odd = [(d.month - 1) // 3 % 2 == 1 for d in days]  # A leads in Q1 and Q3, B in Q2 and Q4
    by_quarter = {"A": [0.0 if o else 1.0 for o in odd], "B": [1.0 if o else 0.0 for o in odd]}
    quarterly = _run(days, by_quarter, _rotation("quarterly", 1, 1))
    assert {m[2] for m in _moves(quarterly, days[-1])} == {
        date(2025, 1, 1),
        date(2025, 4, 1),
        date(2025, 7, 1),
    }


def test_exit_all_sells_everything_and_rebalances_when_the_filter_is_back() -> None:
    days = _weekdays(date(2024, 12, 2), date(2025, 2, 28))
    off = [date(2025, 1, 10) <= d <= date(2025, 1, 20) for d in days]
    scores = {"A": [2.0] * len(days), "B": [1.0] * len(days)}

    result = _run(
        days, scores, _rotation(hold=1, keep=1), regime=[not o for o in off], when_off="exit_all"
    )

    assert _moves(result, days[-1]) == [
        ("A", "buy", date(2025, 1, 1)),
        ("A", "sell", date(2025, 1, 13)),  # the open after the first close with the filter off
        ("A", "buy", date(2025, 1, 22)),  # back on at the 21 Jan close: rebalance at the next bar
    ]


A01 = {
    "mode": "rotation",
    "segment": "equity_delivery",
    "exchange": "NSE",
    "timeframe": "1d",
    "risk": {"stopLossPercent": None, "targetPercent": None},
    "regime": {
        "index": "NIFTY 50",
        "condition": {
            "left": {"kind": "price", "field": "close"},
            "op": "gt",
            "right": {"kind": "indicator", "name": "sma", "params": {"period": 200}},
        },
        "whenOff": "exit_all",
    },
    "rotation": {
        "rebalance": "monthly",
        "hold": 10,
        "keepWithin": 20,
        "score": [
            {
                "operand": {
                    "kind": "indicator",
                    "name": "roc",
                    "params": {"period": 231},
                    "offset": 21,
                },
                "weight": 1,
            }
        ],
    },
}


def test_a01_on_30_stocks_for_two_years_completes(
    clean: Engine, factory: sessionmaker[Session], client: TestClient, parity: Parity
) -> None:
    """NOVA-117 engine check: library A01 (12-1 momentum, NIFTY 50 above its 200-day SMA)."""
    first, start, end = date(2023, 8, 1), date(2024, 10, 1), date(2026, 9, 30)
    days = _weekdays(first, end)
    rng = np.random.default_rng(7)
    rows = []
    for k in range(31):
        symbol = "NIFTY 50" if k == 30 else f"S{k:02d}"
        index = k == 30  # a steady rise: the filter stays on, so buys come only at rebalances
        drift = 0.0006 if index else rng.normal(0.0004, 0.0006)
        closes = 100_000 * np.exp(np.cumsum(rng.normal(drift, 0 if index else 0.015, len(days))))
        for day, close in zip(days, closes.round().astype(int).tolist(), strict=True):
            ts = datetime.combine(day, time(0), tzinfo=IST)
            prices = dict.fromkeys(("open_paise", "high_paise", "low_paise", "close_paise"), close)
            rows.append(
                {"exchange": "NSE", "symbol": symbol, "timeframe": "1d", "ts": ts, "volume": 1_000}
                | prices
            )
    symbols = [f"S{k:02d}" for k in range(30)]
    with Session(clean) as db:
        db.execute(insert(Candle), rows)
        db.add(StrategyVersion(strategy_id="stg_1", version=2, spec=A01))
        db.flush()
        db.add(
            BacktestRun(
                id="run_a01",
                strategy_id="stg_1",
                strategy_version=2,
                name="A01",
                universe={"type": "symbols", "symbols": symbols},
                status="queued",
                date_from=start,
                date_to=end,
                initial_capital_paise=100_000_000,
                benchmark="NIFTY 50",
            )
        )
        db.commit()

    stop = threading.Event()
    run_worker(factory, StrategyEngine(), stop, poll_seconds=0, on_idle=stop.set)

    run = client.get("/api/v1/backtests/run_a01").json()
    assert run["status"] == "completed", run["error"]
    result = client.get("/api/v1/backtests/run_a01/result").json()
    parity.assert_valid(result, "BacktestResult")
    m = result["metrics"]
    assert m["tradeCount"] > 10 and m["estimatedTaxPaise"] is not None
    assert m["benchmarkReturnPercent"] is not None and m["exposurePercent"] > 0
    assert [y["year"] for y in result["years"]] == [1, 2]
    assert sum(y["profitPaise"] for y in result["years"]) == m["netPnlPaise"]
    held = client.get("/api/v1/backtests/run_a01/trades", params={"limit": 200}).json()["items"]
    firsts = {d for d in days if d.month != (d - timedelta(days=3)).month or d.day == 1}
    bought = {datetime.fromisoformat(t["entryAt"]).astimezone(IST).date() for t in held}
    assert bought <= {d for d in firsts if d >= start}  # the first weekday of a month
