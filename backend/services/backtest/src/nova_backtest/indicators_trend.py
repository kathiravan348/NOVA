"""Trend indicators (D51): WMA, MACD signal/histogram, SuperTrend, ADX/DI, Parabolic SAR."""

from collections.abc import Sequence

from nova_backtest.bars import Bar
from nova_backtest.indicators_core import Series, atr, ema_of, macd, rupees, true_ranges, wilder


def wma(values: Sequence[float], period: int) -> Series:
    """Weights 1…period, the newest bar weighs most."""
    out: Series = [None] * len(values)
    total_weight = period * (period + 1) / 2
    for i in range(period - 1, len(values)):
        window = values[i - period + 1 : i + 1]
        out[i] = sum((k + 1) * v for k, v in enumerate(window)) / total_weight
    return out


def macd_signal(closes: Sequence[float], fast: int, slow: int, signal: int) -> Series:
    """EMA(`signal`) of the MACD line, seeded once the line has `signal` values."""
    return ema_of(macd(closes, fast, slow), signal)


def macd_hist(closes: Sequence[float], fast: int, slow: int, signal: int) -> Series:
    line, sig = macd(closes, fast, slow), macd_signal(closes, fast, slow, signal)
    return [
        a - b if a is not None and b is not None else None for a, b in zip(line, sig, strict=True)
    ]


def supertrend(bars: Sequence[Bar], period: int, multiplier: float) -> Series:
    """The active band: the lower band in an up-trend, the upper band in a down-trend.

    Bands are hl2 ± multiplier × ATR, carried the standard way; the first value counts as up-trend.
    """
    highs, lows, closes = rupees(bars)
    ranges = atr(bars, period)
    out: Series = [None] * len(bars)
    upper = lower = 0.0
    up = True
    started = False
    for i, value in enumerate(ranges):
        if value is None:
            continue
        mid = (highs[i] + lows[i]) / 2
        basic_upper, basic_lower = mid + multiplier * value, mid - multiplier * value
        if not started:
            upper, lower, up, started = basic_upper, basic_lower, True, True
        else:
            previous_close = closes[i - 1]
            upper = basic_upper if basic_upper < upper or previous_close > upper else upper
            lower = basic_lower if basic_lower > lower or previous_close < lower else lower
            if up and closes[i] < lower:
                up = False
            elif not up and closes[i] > upper:
                up = True
        out[i] = lower if up else upper
    return out


def _directional(bars: Sequence[Bar], period: int) -> tuple[Series, Series]:
    """+DI and −DI (Wilder): defined from index `period`."""
    highs, lows, _ = rupees(bars)
    plus_dm, minus_dm = [0.0], [0.0]
    for i in range(1, len(bars)):
        move_up, move_down = highs[i] - highs[i - 1], lows[i - 1] - lows[i]
        plus_dm.append(move_up if move_up > move_down and move_up > 0 else 0.0)
        minus_dm.append(move_down if move_down > move_up and move_down > 0 else 0.0)
    ranges = true_ranges(bars)
    smooth_tr = wilder(ranges, period, period)
    smooth_plus, smooth_minus = wilder(plus_dm, period, period), wilder(minus_dm, period, period)
    plus: Series = [None] * len(bars)
    minus: Series = [None] * len(bars)
    for i, tr in enumerate(smooth_tr):
        p, m = smooth_plus[i], smooth_minus[i]
        if tr is None or p is None or m is None:
            continue
        plus[i], minus[i] = (100 * p / tr, 100 * m / tr) if tr else (0.0, 0.0)
    return plus, minus


def plus_di(bars: Sequence[Bar], period: int) -> Series:
    return _directional(bars, period)[0]


def minus_di(bars: Sequence[Bar], period: int) -> Series:
    return _directional(bars, period)[1]


def adx(bars: Sequence[Bar], period: int) -> Series:
    """Wilder average of DX; the first value is at index 2 × period − 1."""
    plus, minus = _directional(bars, period)
    dx = [0.0] * len(bars)
    for i, (p, m) in enumerate(zip(plus, minus, strict=True)):
        if p is not None and m is not None and p + m:
            dx[i] = 100 * abs(p - m) / (p + m)
    return wilder(dx, period, 2 * period - 1)


def psar(bars: Sequence[Bar], step: float, maximum: float) -> Series:
    """Wilder's Parabolic SAR. Starts in an up-trend at bar 1 with SAR = bar 0 low, EP = bar 0 high.

    On a reversal the bar's value is the new SAR (the previous extreme point).
    """
    highs, lows, _ = rupees(bars)
    out: Series = [None] * len(bars)
    if len(bars) < 2:
        return out
    up, sar, extreme, factor = True, lows[0], highs[0], step
    for i in range(1, len(bars)):
        if up and lows[i] < sar:
            up, sar, extreme, factor = False, extreme, lows[i], step
        elif not up and highs[i] > sar:
            up, sar, extreme, factor = True, extreme, highs[i], step
        elif up and highs[i] > extreme:
            extreme, factor = highs[i], min(factor + step, maximum)
        elif not up and lows[i] < extreme:
            extreme, factor = lows[i], min(factor + step, maximum)
        out[i] = sar
        sar += factor * (extreme - sar)
        sar = min(sar, lows[i], lows[i - 1]) if up else max(sar, highs[i], highs[i - 1])
    return out
