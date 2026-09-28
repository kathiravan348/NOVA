"""NOVA-144: new library rules are executable, causal and have known examples."""

import math
from dataclasses import replace
from datetime import datetime, time, timedelta

import numpy as np
import pytest
from nova_backtest.bars import IST, Bar
from nova_backtest.columns import Columns
from nova_backtest.rotation import rotation_arrays
from nova_backtest.rules import signals
from nova_contracts.strategy import StrategySpecRotation, StrategySpecVisual
from nova_strategy.library import load_library

LIMITS = {"A": 12, "B": 14, "C": 14, "D": 6, "E": 2, "F": 2, "G": 10}
NEW = [e for e in load_library().entries if int(e.id[1:]) > LIMITS[e.id[0]]]
MINUTES = {"1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "1d": 375}


def _bars(timeframe: str, count: int = 400) -> list[Bar]:
    bars: list[Bar] = []
    day = datetime(2023, 1, 2).date()
    while len(bars) < count:
        if day.weekday() < 5:
            offsets = [0] if timeframe == "1d" else range(0, 375, MINUTES[timeframe])
            for minutes in offsets:
                k = len(bars)
                close = 10_000 + 12 * k + round(400 * math.sin(k / 7))
                ts = datetime.combine(day, time(9, 15), IST) + timedelta(minutes=minutes)
                bars.append(Bar(ts, close - 20, close + 80, close - 90, close, 1000 + k % 13 * 100))
                if len(bars) == count:
                    break
        day += timedelta(days=1)
    return bars


@pytest.mark.parametrize("entry_id", [e.id for e in NEW])
def test_new_rules_do_not_change_when_future_prices_change(entry_id: str) -> None:
    entry = next(e for e in NEW if e.id == entry_id)
    bars = _bars(entry.spec.timeframe)
    split = 300
    changed = bars[:split] + [
        replace(b, open=b.open * 3, high=b.high * 3, low=b.low * 3, close=b.close * 3)
        for b in bars[split:]
    ]
    before, after = Columns.from_bars(bars), Columns.from_bars(changed)
    spec = entry.spec
    if isinstance(spec, StrategySpecRotation):
        scores, eligible = rotation_arrays(before, spec.rotation)
        changed_scores, changed_eligible = rotation_arrays(after, spec.rotation)
        np.testing.assert_allclose(scores[:split], changed_scores[:split], equal_nan=True)
        np.testing.assert_array_equal(eligible[:split], changed_eligible[:split])
        assert np.isnan(scores[0]) and not eligible[0]
    else:
        assert isinstance(spec, StrategySpecVisual)
        enter, exit_ = signals(before, spec.entry, spec.exit)
        changed_enter, changed_exit = signals(after, spec.entry, spec.exit)
        np.testing.assert_array_equal(enter[:split], changed_enter[:split])
        np.testing.assert_array_equal(exit_[:split], changed_exit[:split])
        assert len(enter) == len(exit_) == 400
        assert not enter[0]


def _spec(entry_id: str) -> StrategySpecVisual:
    spec = next(e.spec for e in NEW if e.id == entry_id)
    assert isinstance(spec, StrategySpecVisual)
    return spec


def _inside_bars() -> list[Bar]:
    bars = _bars("5m", 57)
    for k in range(53):
        bars[k] = replace(bars[k], open=10_000, high=10_100, low=9900, close=10_000)
    bars[53] = replace(bars[53], open=10_200, high=10_500, low=9900, close=10_200)
    bars[54] = replace(bars[54], open=10_200, high=10_400, low=10_000, close=10_200)
    bars[55] = replace(bars[55], open=10_200, high=10_300, low=10_100, close=10_200)
    bars[56] = replace(bars[56], open=10_350, high=10_500, low=10_300, close=10_450)
    return bars


def test_nested_inside_breakout_requires_both_nested_bars() -> None:
    spec = _spec("G16")
    bars = _inside_bars()
    enter, _ = signals(Columns.from_bars(bars), spec.entry, spec.exit)
    assert enter[-1]
    # The prior bar no longer fits inside its parent, while the latest breakout stays identical.
    bars[54] = replace(bars[54], low=9800)
    blocked, _ = signals(Columns.from_bars(bars), spec.entry, spec.exit)
    assert not blocked[-1]


def test_nested_inside_exit_below_ema20() -> None:
    spec = _spec("G16")
    bars = _inside_bars()
    bars[-1] = replace(bars[-1], open=9800, high=9850, low=9650, close=9700)
    _, exit_ = signals(Columns.from_bars(bars), spec.entry, spec.exit)
    assert exit_[-1]


def test_failed_previous_low_reclaims_and_loses_the_level() -> None:
    spec = _spec("G17")
    bars = _bars("5m", 75)
    bars = [replace(b, open=10_600, high=10_700, low=10_500, close=10_600) for b in bars]
    t0 = datetime.combine(bars[-1].ts.date() + timedelta(days=1), time(9, 15), IST)
    bars.extend(
        [
            Bar(t0, 10_400, 10_450, 10_350, 10_400, 1000),
            Bar(t0 + timedelta(minutes=5), 10_800, 10_850, 10_750, 10_800, 1000),
        ]
    )
    enter, exit_ = signals(Columns.from_bars(bars), spec.entry, spec.exit)
    assert not enter[-2] and enter[-1] and not exit_[-1]
    bars[-1] = replace(bars[-1], open=10_300, high=10_350, low=10_250, close=10_300)
    enter, exit_ = signals(Columns.from_bars(bars), spec.entry, spec.exit)
    assert not enter[-1] and exit_[-1]
