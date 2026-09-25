from datetime import UTC, datetime, timedelta

import pytest
from nova_backtest.bars import Bar
from nova_backtest.indicators import indicator
from nova_backtest.indicators_trend import (
    adx,
    macd_hist,
    macd_signal,
    minus_di,
    plus_di,
    psar,
    supertrend,
    wma,
)

T0 = datetime(2026, 9, 1, 4, 0, tzinfo=UTC)


def _p(rupees: float) -> int:
    return round(rupees * 100)


def _bars(*hlc: tuple[float, float, float]) -> list[Bar]:
    """Daily bars from (high, low, close) in rupees; open = close."""
    return [
        Bar(
            T0 + timedelta(days=i),
            round(c * 100),
            round(h * 100),
            round(low * 100),
            round(c * 100),
            100,
        )
        for i, (h, low, c) in enumerate(hlc)
    ]


def test_wma_weights_the_newest_bar_most() -> None:
    # (1·1 + 2·2 + 3·3) / 6 = 14/6; (1·2 + 2·3 + 3·4) / 6 = 20/6
    assert wma([1, 2, 3, 4], 3) == pytest.approx([None, None, 14 / 6, 20 / 6])


def test_macd_signal_and_histogram() -> None:
    # EMA(1) = closes; EMA(2): seed 1.5, then 2/3·4 + 1/3·1.5 = 3.1667, 2/3·8 + 1/3·3.1667 = 6.3889
    # line = 0.5, 0.8333, 1.6111
    # signal(2): seed (0.5 + 0.8333)/2 = 0.6667, then 2/3·1.6111 + 1/3·0.6667
    closes = [1.0, 2.0, 4.0, 8.0]
    signal = macd_signal(closes, 1, 2, 2)

    assert signal[:2] == [None, None]
    assert signal[2] == pytest.approx(2 / 3)
    assert signal[3] == pytest.approx(2 / 3 * (8 - 115 / 18) + 1 / 3 * 2 / 3)
    last = signal[3]
    assert last is not None
    assert macd_hist(closes, 1, 2, 2)[3] == pytest.approx((8 - 115 / 18) - last)


def test_supertrend_holds_the_lower_band_then_flips_down() -> None:
    # TR 2, 2, 2, 11 → ATR(2) from bar 1: 2, 2, (2 + 11)/2 = 6.5
    # bar 1-2: hl2 100 − 1·2 = 98 (up-trend); bar 3: close 90 < 98 → down, upper = 90 + 6.5 = 96.5
    bars = _bars((101, 99, 100), (101, 99, 100), (101, 99, 100), (91, 89, 90))

    assert supertrend(bars, 2, 1) == pytest.approx([None, 98, 98, 96.5])


def test_directional_movement_and_adx() -> None:
    # +DM 2, 1, 0, 0; −DM 0, 0, 1, 2; TR 3, 3, 3, 4 (bars 1-4), Wilder(2) from bar 2:
    # TR 3, 3, 3.5; +DM 1.5, 0.75, 0.375; −DM 0, 0.5, 1.25
    # +DI 50, 25, 10.714; −DI 0, 16.667, 35.714; DX 100, 20, 53.846; ADX(bar 3) = 60, bar 4 = 56.923
    bars = _bars((10, 8, 9), (12, 9, 11), (13, 10, 12), (12, 9, 10), (11, 7, 8))

    assert plus_di(bars, 2) == pytest.approx([None, None, 50, 25, 0.375 / 3.5 * 100])
    assert minus_di(bars, 2) == pytest.approx([None, None, 0, 50 / 3, 1.25 / 3.5 * 100])
    dx4 = 100 * (1.25 - 0.375) / (1.25 + 0.375)  # DIs share the smoothed TR, so it cancels
    assert adx(bars, 2) == pytest.approx([None, None, None, 60, (60 + dx4) / 2])


def test_parabolic_sar_rises_then_reverses() -> None:
    # bar 1: SAR 9 (bar 0 low), EP 11, AF .04 → next 9.08, capped at min(lows 10, 9) = 9
    # bar 2: SAR 9, EP 12, AF .06 → next 9.18; bar 3: low 8 < 9.18 → reverse, SAR = EP 12
    bars = _bars((10, 9, 9.5), (11, 10, 10.5), (12, 11, 11.5), (9, 8, 8.5))

    assert psar(bars, 0.02, 0.2) == pytest.approx([None, 9, 9, 12])


@pytest.mark.parametrize(
    ("name", "first"),
    [
        ("wma", 19),
        ("macd_signal", 33),
        ("macd_hist", 33),
        ("supertrend", 9),
        ("adx", 27),
        ("plus_di", 14),
        ("minus_di", 14),
        ("psar", 1),
    ],
)
def test_none_prefix_with_defaults(name: str, first: int) -> None:
    bars = _bars(*[(100 + i % 7 + 1, 100 + i % 7 - 1, 100 + i % 7) for i in range(60)])

    values = indicator(name, {}, bars)

    assert len(values) == 60
    assert all(v is None for v in values[:first])
    assert all(v is not None for v in values[first:])


def test_macd_uses_its_own_settings() -> None:
    bars = _bars(*[(100 + i + 1, 100 + i - 1, 100 + (i * 7) % 11) for i in range(60)])

    assert indicator("macd", {"fast": 5, "slow": 10}, bars) != indicator("macd", {}, bars)
    with pytest.raises(ValueError, match="Unknown setting 'period' for MACD line"):
        indicator("macd", {"period": 20}, bars)
