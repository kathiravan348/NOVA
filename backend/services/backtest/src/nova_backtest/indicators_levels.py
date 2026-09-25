"""Channels and levels (D51): Donchian, Keltner, previous IST day high/low/close, pivots."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date

from nova_backtest.bars import Bar
from nova_backtest.indicators_core import Series, atr, ema, highest, lowest, rupees


def donchian(bars: Sequence[Bar], period: int, upper: bool) -> Series:
    """Highest high / lowest low of the last `period` bars, the current bar included."""
    highs, lows, _ = rupees(bars)
    out: Series = [None] * len(bars)
    for i in range(period - 1, len(bars)):
        out[i] = highest(highs, period, i) if upper else lowest(lows, period, i)
    return out


def keltner(
    bars: Sequence[Bar], period: int, multiplier: float, atr_period: int, upper: bool
) -> Series:
    """EMA(`period`) of close ± `multiplier` × ATR(`atr_period`)."""
    _, _, closes = rupees(bars)
    sign = 1 if upper else -1
    return [
        mid + sign * multiplier * width if mid is not None and width is not None else None
        for mid, width in zip(ema(closes, period), atr(bars, atr_period), strict=True)
    ]


@dataclass(frozen=True)
class Day:
    high: float
    low: float
    close: float

    @property
    def pivot(self) -> float:
        return (self.high + self.low + self.close) / 3


def _previous_days(bars: Sequence[Bar]) -> list[Day | None]:
    """For each bar, the previous IST day's high, low and last close (`None` on the first day)."""
    days: dict[date, Day] = {}
    for bar in bars:
        day, seen = bar.ist_date, days.get(bar.ist_date)
        high, low, close = bar.high / 100, bar.low / 100, bar.close / 100
        days[day] = (
            Day(max(seen.high, high), min(seen.low, low), close) if seen else Day(high, low, close)
        )
    order = list(days)
    before = {day: days[order[k - 1]] if k else None for k, day in enumerate(order)}
    return [before[bar.ist_date] for bar in bars]


LEVELS: dict[str, Callable[[Day], float]] = {
    "prev_day_high": lambda d: d.high,
    "prev_day_low": lambda d: d.low,
    "prev_day_close": lambda d: d.close,
    "pivot": lambda d: d.pivot,
    "pivot_r1": lambda d: 2 * d.pivot - d.low,
    "pivot_s1": lambda d: 2 * d.pivot - d.high,
    "pivot_r2": lambda d: d.pivot + (d.high - d.low),
    "pivot_s2": lambda d: d.pivot - (d.high - d.low),
}


def level(bars: Sequence[Bar], name: str) -> Series:
    value = LEVELS[name]
    return [value(day) if day else None for day in _previous_days(bars)]
