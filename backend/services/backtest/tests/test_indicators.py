from datetime import UTC, datetime, timedelta

import pytest
from nova_backtest.bars import Bar
from nova_backtest.indicators import atr, bollinger, ema, indicator, rsi, sma, vwap


def _bar(ts: datetime, close: float, spread: float = 1.0, volume: int = 100) -> Bar:
    paise = round(close * 100)
    step = round(spread * 100)
    return Bar(ts, paise, paise + step, paise - step, paise, volume)


def test_sma_and_ema() -> None:
    assert sma([1, 2, 3, 4, 5], 3) == [None, None, 2, 3, 4]
    assert ema([1, 2, 3, 4, 5], 3) == [None, None, 2, 3, 4]  # seed 2, then α = 0.5
    assert ema([1, 2], 3) == [None, None]


def test_rsi_uses_wilder_smoothing() -> None:
    values = rsi([1, 2, 1, 2, 1, 2], 2)

    assert values[:2] == [None, None]
    assert values[2] == 50.0  # avg gain 0.5, avg loss 0.5
    assert values[3] == pytest.approx(75.0)  # gain (0.5 + 1) / 2, loss 0.5 / 2
    assert rsi([1, 2, 3, 4], 2)[3] == 100.0  # no losses


def test_vwap_restarts_each_ist_day() -> None:
    day = datetime(2026, 9, 24, 3, 45, tzinfo=UTC)
    bars = [
        _bar(day, 100, 0, volume=100),
        _bar(day + timedelta(minutes=5), 110, 0, volume=300),
        _bar(day + timedelta(days=1), 200, 0, volume=50),
    ]

    assert vwap(bars) == [100.0, 107.5, 200.0]


def test_atr_and_bollinger() -> None:
    t0 = datetime(2026, 9, 1, tzinfo=UTC)
    bars = [_bar(t0 + timedelta(days=i), 100, spread=1) for i in range(5)]

    assert atr(bars, 3)[:2] == [None, None]
    assert atr(bars, 3)[4] == pytest.approx(2.0)  # constant ₹2 range
    assert bollinger([5, 5, 5], 2, 2, upper=True) == [None, 5.0, 5.0]


def test_bad_parameters_are_refused() -> None:
    with pytest.raises(ValueError, match="period"):
        indicator("sma", {"period": 0}, [])
    with pytest.raises(ValueError, match="period"):
        indicator("rsi", {"period": 2.5}, [])
