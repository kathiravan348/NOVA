"""Momentum indicators (D51): Stochastic, Stochastic RSI, CCI, Williams %R, rate of change."""

from collections.abc import Sequence

from nova_backtest.bars import Bar
from nova_backtest.indicators_core import Series, highest, lowest, rsi, rupees, sma, sma_of


def _raw_k(bars: Sequence[Bar], period: int) -> Series:
    """100 × (close − lowest low) / (highest high − lowest low); a flat range gives 50."""
    highs, lows, closes = rupees(bars)
    out: Series = [None] * len(bars)
    for i in range(period - 1, len(bars)):
        top, bottom = highest(highs, period, i), lowest(lows, period, i)
        out[i] = 50.0 if top == bottom else 100 * (closes[i] - bottom) / (top - bottom)
    return out


def stoch_k(bars: Sequence[Bar], period: int, smooth: int) -> Series:
    return sma_of(_raw_k(bars, period), smooth)


def stoch_d(bars: Sequence[Bar], period: int, smooth: int, signal: int) -> Series:
    return sma_of(stoch_k(bars, period, smooth), signal)


def stoch_rsi(closes: Sequence[float], rsi_period: int, period: int) -> Series:
    """Where RSI sits in its own range over `period` bars, 0–100; a flat range gives 50."""
    values = rsi(closes, rsi_period)
    out: Series = [None] * len(closes)
    for i in range(period - 1, len(closes)):
        window = [v for v in values[i - period + 1 : i + 1] if v is not None]
        current = values[i]
        if len(window) < period or current is None:
            continue
        top, bottom = max(window), min(window)
        out[i] = 50.0 if top == bottom else 100 * (current - bottom) / (top - bottom)
    return out


def cci(bars: Sequence[Bar], period: int) -> Series:
    """(TP − SMA(TP)) / (0.015 × mean deviation), TP = (H + L + C) / 3; zero deviation gives 0."""
    highs, lows, closes = rupees(bars)
    typical = [(h + low + c) / 3 for h, low, c in zip(highs, lows, closes, strict=True)]
    means = sma(typical, period)
    out: Series = [None] * len(bars)
    for i, mean in enumerate(means):
        if mean is None:
            continue
        deviation = sum(abs(t - mean) for t in typical[i - period + 1 : i + 1]) / period
        out[i] = 0.0 if deviation == 0 else (typical[i] - mean) / (0.015 * deviation)
    return out


def williams_r(bars: Sequence[Bar], period: int) -> Series:
    """−100 × (highest high − close) / (highest high − lowest low); a flat range gives −50."""
    highs, lows, closes = rupees(bars)
    out: Series = [None] * len(bars)
    for i in range(period - 1, len(bars)):
        top, bottom = highest(highs, period, i), lowest(lows, period, i)
        out[i] = -50.0 if top == bottom else -100 * (top - closes[i]) / (top - bottom)
    return out


def roc(closes: Sequence[float], period: int) -> Series:
    """100 × (close / close `period` bars ago − 1)."""
    out: Series = [None] * len(closes)
    for i in range(period, len(closes)):
        if closes[i - period]:
            out[i] = 100 * (closes[i] / closes[i - period] - 1)
    return out
