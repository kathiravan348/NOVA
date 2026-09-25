"""Channels and previous-day levels (D51), plus one visual backtest that uses them end to end."""

import threading
from datetime import UTC, date, datetime, time, timedelta

import pytest
from nova_backtest.bars import IST, Bar
from nova_backtest.indicators import indicator
from nova_backtest.indicators_levels import donchian, keltner, level
from nova_backtest.strategy_engine import StrategyEngine
from nova_backtest.worker import run_worker
from nova_db.models import BacktestResult, BacktestRun, Candle, StrategyVersion
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

T0 = datetime(2026, 9, 1, 4, 0, tzinfo=UTC)


def _bar(ts: datetime, high: float, low: float, close: float) -> Bar:
    return Bar(ts, round(close * 100), round(high * 100), round(low * 100), round(close * 100), 100)


def test_donchian_includes_the_current_bar() -> None:
    hlc = [(10, 8, 9), (12, 9, 11), (11, 7, 8)]
    bars = [_bar(T0 + timedelta(days=i), h, low, c) for i, (h, low, c) in enumerate(hlc)]

    assert donchian(bars, 2, upper=True) == [None, 12, 12]
    assert donchian(bars, 2, upper=False) == [None, 8, 7]


def test_keltner_is_ema_plus_minus_atr() -> None:
    # closes 10, 10, 10 with a ₹2 range: EMA(2) 10, ATR(2) 2 → 10 ± 1.5 · 2
    bars = [_bar(T0 + timedelta(days=i), 11, 9, 10) for i in range(3)]

    assert keltner(bars, 2, 1.5, 2, upper=True) == pytest.approx([None, 13, 13])
    assert keltner(bars, 2, 1.5, 2, upper=False) == pytest.approx([None, 7, 7])


def test_previous_ist_day_levels_on_five_minute_bars() -> None:
    # 18:25 UTC is 23:55 IST; 10 minutes later it is the next IST day.
    late = datetime(2026, 9, 1, 18, 25, tzinfo=UTC)
    bars = [
        _bar(late - timedelta(minutes=5), 105, 100, 102),  # IST 1 Sep
        _bar(late, 108, 101, 104),  # IST 1 Sep → H 108, L 100, C 104
        _bar(late + timedelta(minutes=10), 110, 103, 109),  # IST 2 Sep
        _bar(late + timedelta(days=1), 112, 99, 100),  # IST 2 Sep 23:55 → H 112, L 99, C 100
        _bar(late + timedelta(days=1, minutes=10), 101, 98, 99),  # IST 3 Sep
    ]

    assert level(bars, "prev_day_high") == [None, None, 108, 108, 112]
    assert level(bars, "prev_day_low") == [None, None, 100, 100, 99]
    assert level(bars, "prev_day_close") == [None, None, 104, 104, 100]
    # 1 Sep: P = (108 + 100 + 104)/3 = 104; R1 = 2·104 − 100 = 108; S1 = 100; R2 = 112; S2 = 96
    names = ("pivot", "pivot_r1", "pivot_s1", "pivot_r2", "pivot_s2")
    assert [level(bars, n)[2] for n in names] == pytest.approx([104, 108, 100, 112, 96])


def test_daily_bars_use_the_previous_bar() -> None:
    start = datetime(2026, 9, 1, tzinfo=IST).astimezone(UTC)
    bars = [_bar(start + timedelta(days=i), 10 + i, 5 + i, 8 + i) for i in range(3)]

    assert indicator("prev_day_high", {}, bars) == [None, 10, 11]
    assert indicator("prev_day_close", {}, bars) == [None, 8, 9]


# Daily rupee (high, low, close); open = the previous close. Pivot R1 from day 1 is 100, from
# day 2 it is 101.33: day 2 closes at 99 (below 100), day 3 at 103 (above 101.33): a cross above.
DAYS = [(100, 90, 95), (100, 94, 99), (104, 99, 103), (106, 102, 105), (107, 104, 106)]
SPEC = {
    "mode": "visual",
    "segment": "equity_delivery",
    "exchange": "NSE",
    "timeframe": "1d",
    "sizing": {"type": "fixed_qty", "qty": 1},
    "risk": {"stopLossPercent": None, "targetPercent": None},
    "entry": {
        "combinator": "all",
        "conditions": [
            {
                "left": {"kind": "price", "field": "close"},
                "op": "crosses_above",
                "right": {"kind": "indicator", "name": "pivot_r1", "params": {}},
            }
        ],
    },
    "exit": {
        "combinator": "all",
        "conditions": [
            {
                "left": {"kind": "indicator", "name": "mfi", "params": {"period": 2}},
                "op": "lt",
                "right": {"kind": "number", "value": 20},
            }
        ],
    },
}


def test_a_visual_run_with_pivots_and_mfi_completes(
    clean: Engine, factory: sessionmaker[Session]
) -> None:
    with Session(clean) as db:
        db.add(StrategyVersion(strategy_id="stg_1", version=2, spec=SPEC))
        db.flush()
        previous = DAYS[0][2]
        for i, (high, low, close) in enumerate(DAYS):
            db.add(
                Candle(
                    exchange="NSE",
                    symbol="INFY",
                    timeframe="1d",
                    ts=datetime.combine(date(2025, 1, 1) + timedelta(days=i), time(0), tzinfo=IST),
                    open_paise=previous * 100,
                    high_paise=high * 100,
                    low_paise=low * 100,
                    close_paise=close * 100,
                    volume=1_000,
                )
            )
            previous = close
        db.add(
            BacktestRun(
                id="run_levels",
                strategy_id="stg_1",
                strategy_version=2,
                name="Levels",
                universe={"type": "symbols", "symbols": ["INFY"]},
                status="queued",
                date_from=date(2025, 1, 1),
                date_to=date(2025, 1, 5),
                initial_capital_paise=10_000_000,
                benchmark=None,
            )
        )
        db.commit()

    stop = threading.Event()
    run_worker(factory, StrategyEngine(), stop, poll_seconds=0, on_idle=stop.set)

    with factory() as db:
        run = db.get(BacktestRun, "run_levels")
        assert run is not None
        assert (run.status, run.error) == ("completed", None)
        result = db.get(BacktestResult, "run_levels")
        assert result is not None and result.trade_count == 1
