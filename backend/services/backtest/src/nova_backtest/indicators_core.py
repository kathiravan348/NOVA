"""Indicator building blocks (D45, D51): moving averages, Wilder smoothing, ranges.

Floats in rupees are fine here: they only decide signals, never amounts. Every function returns
one value per bar, `None` until there are enough bars.
"""

import math
from collections.abc import Sequence

from nova_backtest.bars import Bar

Series = list[float | None]


def sma(values: Sequence[float], period: int) -> Series:
    out: Series = [None] * len(values)
    total = 0.0
    for i, value in enumerate(values):
        total += value
        if i >= period:
            total -= values[i - period]
        if i >= period - 1:
            out[i] = total / period
    return out


def ema(values: Sequence[float], period: int) -> Series:
    """Seeded with the SMA of the first `period` values."""
    out: Series = [None] * len(values)
    if len(values) < period:
        return out
    alpha = 2 / (period + 1)
    current = sum(values[:period]) / period
    out[period - 1] = current
    for i in range(period, len(values)):
        current = alpha * values[i] + (1 - alpha) * current
        out[i] = current
    return out


def wilder(values: Sequence[float], period: int, first: int) -> Series:
    """Wilder smoothing starting at index `first` (the first full window ends there)."""
    out: Series = [None] * len(values)
    if len(values) <= first:
        return out
    current = sum(values[first - period + 1 : first + 1]) / period
    out[first] = current
    for i in range(first + 1, len(values)):
        current = (current * (period - 1) + values[i]) / period
        out[i] = current
    return out


def rsi(closes: Sequence[float], period: int) -> Series:
    changes = [0.0] + [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = wilder([max(c, 0.0) for c in changes], period, period)
    losses = wilder([max(-c, 0.0) for c in changes], period, period)
    out: Series = [None] * len(closes)
    for i, (gain, loss) in enumerate(zip(gains, losses, strict=True)):
        if gain is None or loss is None:
            continue
        out[i] = 100.0 if loss == 0 else 100 - 100 / (1 + gain / loss)
    return out


def macd(closes: Sequence[float], fast: int, slow: int) -> Series:
    """The MACD line: EMA(fast) − EMA(slow)."""
    return [
        f - s if f is not None and s is not None else None
        for f, s in zip(ema(closes, fast), ema(closes, slow), strict=True)
    ]


def vwap(bars: Sequence[Bar]) -> Series:
    """Volume-weighted typical price, restarting each IST day (a daily bar is its own day)."""
    out: Series = []
    day, value, volume = None, 0.0, 0
    for bar in bars:
        if bar.ist_date != day:
            day, value, volume = bar.ist_date, 0.0, 0
        typical = (bar.high + bar.low + bar.close) / 300  # rupees
        value += typical * bar.volume
        volume += bar.volume
        out.append(value / volume if volume else typical)
    return out


def atr(bars: Sequence[Bar], period: int) -> Series:
    return wilder(true_ranges(bars), period, period - 1)


def bollinger(closes: Sequence[float], period: int, stddev: float, upper: bool) -> Series:
    middle = sma(closes, period)
    out: Series = [None] * len(closes)
    for i, mean in enumerate(middle):
        if mean is None:
            continue
        window = closes[i - period + 1 : i + 1]
        spread = stddev * math.sqrt(sum((x - mean) ** 2 for x in window) / period)
        out[i] = mean + spread if upper else mean - spread
    return out


def sma_of(values: Series, period: int) -> Series:
    """SMA of a series that starts with `None`s: defined once `period` values in a row are known."""
    out: Series = [None] * len(values)
    for i in range(period - 1, len(values)):
        window = values[i - period + 1 : i + 1]
        if all(v is not None for v in window):
            out[i] = sum(v for v in window if v is not None) / period
    return out


def ema_of(values: Series, period: int) -> Series:
    """EMA of a series that starts with `None`s, seeded with the SMA of the first `period` known."""
    first = next((i for i, v in enumerate(values) if v is not None), len(values))
    known = [v for v in values[first:] if v is not None]
    head: Series = [None] * first
    out = head + ema(known, period)
    tail: Series = [None] * (len(values) - len(out))
    return out + tail


def rupees(bars: Sequence[Bar]) -> tuple[list[float], list[float], list[float]]:
    """Highs, lows and closes in rupees."""
    return (
        [bar.high / 100 for bar in bars],
        [bar.low / 100 for bar in bars],
        [bar.close / 100 for bar in bars],
    )


def true_ranges(bars: Sequence[Bar]) -> list[float]:
    highs, lows, closes = rupees(bars)
    return [
        highs[i] - lows[i]
        if i == 0
        else max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1]))
        for i in range(len(bars))
    ]


def highest(values: Sequence[float], period: int, i: int) -> float:
    return max(values[i - period + 1 : i + 1])


def lowest(values: Sequence[float], period: int, i: int) -> float:
    return min(values[i - period + 1 : i + 1])
