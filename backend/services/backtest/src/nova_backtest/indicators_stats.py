"""Statistics indicators (D62 (5)): volatility, risk-adjusted return, % of the N-bar high.

Computed with numpy in blocks, so a long 1-minute series never needs a bars × period matrix.
"""

import math

import numpy as np
import numpy.typing as npt
from numpy.lib.stride_tricks import sliding_window_view

from nova_backtest.columns import Columns
from nova_backtest.indicators_core import Series

Floats = npt.NDArray[np.float64]
BLOCK = 20_000
# Bars in a trading year: 252 days, times the bars in a 09:15–15:30 session intraday.
BARS_PER_DAY = {
    "1s": 22_500,
    "5s": 4500,
    "15s": 1500,
    "30s": 750,
    "1m": 375,
    "3m": 125,
    "5m": 75,
    "15m": 25,
    "30m": 13,
    "1h": 7,
}


def bars_per_year(timeframe: str) -> int:
    return 252 * BARS_PER_DAY.get(timeframe, 1)


def _series(values: Floats) -> Series:
    return [None if math.isnan(v) else v for v in values.tolist()]


def _volatility(closes: Floats, period: int, per_year: int) -> Floats:
    """Sample std dev (n − 1) of the last `period` bar-to-bar returns × √per_year × 100."""
    out = np.full(len(closes), np.nan)
    if period < 2 or len(closes) <= period:
        return out
    with np.errstate(divide="ignore", invalid="ignore"):
        returns = np.where(closes[:-1] != 0, closes[1:] / closes[:-1] - 1, np.nan)
    windows = sliding_window_view(returns, period)  # window k ends at bar k + period
    scale = math.sqrt(per_year) * 100
    for start in range(0, len(windows), BLOCK):
        part = windows[start : start + BLOCK]
        out[start + period : start + period + len(part)] = part.std(axis=1, ddof=1) * scale
    return out


def volatility(bars: Columns, period: int) -> Series:
    return _series(_volatility(bars.close / 100, period, bars_per_year(bars.timeframe)))


def risk_adj_return(bars: Columns, period: int) -> Series:
    """Rate of change % ÷ volatility % over the same period; none when the volatility is 0."""
    closes = bars.close / 100
    vol = _volatility(closes, period, bars_per_year(bars.timeframe))
    change = np.full(len(closes), np.nan)
    if len(closes) > period:
        before = closes[:-period]
        with np.errstate(divide="ignore", invalid="ignore"):
            change[period:] = np.where(before != 0, 100 * (closes[period:] / before - 1), np.nan)
    with np.errstate(divide="ignore", invalid="ignore"):
        ratio = np.where(vol > 0, change / vol, np.nan)
    return _series(ratio)


def pct_of_high(bars: Columns, period: int) -> Series:
    """Close ÷ the highest high of the last `period` bars (this one included) × 100."""
    closes, highs = bars.close / 100, bars.high / 100
    out = np.full(len(closes), np.nan)
    if len(closes) >= period:
        peak = sliding_window_view(highs, period).max(axis=1)
        with np.errstate(divide="ignore", invalid="ignore"):
            out[period - 1 :] = np.where(peak > 0, closes[period - 1 :] / peak * 100, np.nan)
    return _series(out)
