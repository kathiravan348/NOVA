"""NOVA-127 (D62 (5)): volatility, risk-adjusted return, % of high and the opening range."""

import math
from datetime import datetime, time, timedelta

import pytest
from nova_backtest.bars import IST, Bar
from nova_backtest.columns import Columns
from nova_backtest.indicators import indicator
from nova_backtest.sandbox import ENTER, check_code, run_python_one

DAY0 = datetime(2026, 9, 1, tzinfo=IST)


def _daily(closes: list[float], highs: list[float] | None = None) -> Columns:
    highs = highs or closes
    return Columns.from_bars(
        [
            Bar(
                DAY0 + timedelta(days=i),
                round(c * 100),
                round(h * 100),
                round(c * 100),
                round(c * 100),
                1,
            )
            for i, (c, h) in enumerate(zip(closes, highs, strict=True))
        ]
    )


def _quarter_hours(days: int, highs: list[float], lows: list[float]) -> Columns:
    """15m bars from 09:15 IST, `len(highs)` a day, the same highs and lows each day."""
    bars = [
        Bar(
            datetime.combine((DAY0 + timedelta(days=d)).date(), time(9, 15), tzinfo=IST)
            + timedelta(minutes=15 * k),
            round(lo * 100),
            round(h * 100),
            round(lo * 100),
            round(lo * 100),
            1,
        )
        for d in range(days)
        for k, (h, lo) in enumerate(zip(highs, lows, strict=True))
    ]
    return Columns.from_bars(bars, "15m")


def test_a_constant_return_has_no_volatility() -> None:
    doubling = _daily([100, 200, 400, 800, 1600])

    assert indicator("volatility", {"period": 3}, doubling) == [None, None, None, 0.0, 0.0]
    assert indicator("risk_adj_return", {"period": 3}, doubling)[3:] == [None, None]  # ÷ 0


def test_two_returns_give_the_scaled_sample_deviation() -> None:
    closes = _daily([100, 110, 99])  # returns +10 %, −10 %: sample std dev √0.02

    yearly = math.sqrt(0.02) * math.sqrt(252) * 100

    assert indicator("volatility", {"period": 2}, closes)[2] == pytest.approx(yearly)
    ratio = indicator("risk_adj_return", {"period": 2}, closes)[2]
    assert ratio == pytest.approx(-1 / yearly)  # rate of change −1 %
    quarter = Columns.from_bars(closes.to_bars(), "15m")  # 25 bars a day: × √25
    assert indicator("volatility", {"period": 2}, quarter)[2] == pytest.approx(yearly * 5)


def test_pct_of_high_is_100_on_a_new_high() -> None:
    bars = _daily([100, 90, 120, 60], highs=[105, 95, 120, 80])

    assert indicator("pct_of_high", {"period": 2}, bars) == [
        None,
        pytest.approx(90 / 105 * 100),
        100.0,
        50.0,
    ]


def test_the_opening_range_appears_once_it_is_complete() -> None:
    bars = _quarter_hours(2, highs=[101, 105, 103, 108], lows=[99, 97, 100, 96])

    or_15 = indicator("or_high", {"minutes": 15}, bars)
    or_30 = indicator("or_high", {"minutes": 30}, bars)
    low_30 = indicator("or_low", {"minutes": 30}, bars)

    assert or_15 == [None, 101.0, 101.0, 101.0] * 2  # the 09:15 bar's high from 09:30
    assert or_30 == [None, None, 105.0, 105.0] * 2  # two bars, from 09:45; each day anew
    assert low_30 == [None, None, 97.0, 97.0] * 2


def test_no_opening_range_on_daily_bars() -> None:
    assert indicator("or_low", {}, _daily([100, 101])) == [None, None]


def test_python_mode_reads_the_new_indicators() -> None:
    code = (
        "class Strategy:\n"
        "    def on_bar(self, ctx):\n"
        "        vol, top = ctx.volatility(2), ctx.or_high(15)\n"
        "        if vol is not None and top is not None and ctx.close <= top:\n"
        '            return "enter"\n'
        "        return None\n"
    )
    bars = _quarter_hours(1, highs=[101, 105, 103, 108], lows=[99, 97, 100, 96])

    codes = run_python_one(code, "INFY", bars, check_code(code))

    assert (codes == ENTER).tolist() == [False, False, True, True]
