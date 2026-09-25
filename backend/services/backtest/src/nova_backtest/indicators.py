"""Indicator series (D45). Floats in rupees are fine here: they only decide signals, never amounts.

Every function returns one value per bar, `None` until there are enough bars.
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


def _wilder(values: Sequence[float], period: int, first: int) -> Series:
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
    gains = _wilder([max(c, 0.0) for c in changes], period, period)
    losses = _wilder([max(-c, 0.0) for c in changes], period, period)
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
    ranges = []
    for i, bar in enumerate(bars):
        high, low = bar.high / 100, bar.low / 100
        previous = bars[i - 1].close / 100 if i else None
        ranges.append(
            high - low
            if previous is None
            else max(high - low, abs(high - previous), abs(low - previous))
        )
    return _wilder(ranges, period, period - 1)


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


def whole(params: dict[str, float], name: str, default: int) -> int:
    """A positive whole-number parameter such as `period`."""
    value = params.get(name, default)
    if value != int(value) or value < 1:
        raise ValueError(f"{name} must be a whole number of at least 1, got {value}")
    return int(value)


def indicator(name: str, params: dict[str, float], bars: Sequence[Bar]) -> Series:
    closes = [bar.close / 100 for bar in bars]
    if name == "sma":
        return sma(closes, whole(params, "period", 20))
    if name == "ema":
        return ema(closes, whole(params, "period", 20))
    if name == "rsi":
        return rsi(closes, whole(params, "period", 14))
    if name == "macd":
        return macd(closes, whole(params, "fast", 12), whole(params, "slow", 26))
    if name == "vwap":
        return vwap(bars)
    if name == "atr":
        return atr(bars, whole(params, "period", 14))
    if name in ("bb_upper", "bb_lower"):
        spread = params.get("stddev", 2.0)
        return bollinger(closes, whole(params, "period", 20), spread, upper=name == "bb_upper")
    raise ValueError(f"Unknown indicator {name}")
