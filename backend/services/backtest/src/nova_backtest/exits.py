"""Exits that follow a holding (D62 (3)): trailing and ATR stop levels, and bars held.

Levels trail the highest close since the first buy, are set at a close, only move up, and are
checked from the next bar like the stop-loss; the highest of all stop levels wins.
"""

import math
from decimal import ROUND_HALF_UP, Decimal

from nova_contracts.strategy import Risk

from nova_backtest.book import Position, percent_of


def atr_level(highest_close: int, multiplier: float, atr: float) -> int | None:
    """`highest_close − multiplier × ATR` in paise (ATR is in rupees); None without an ATR yet."""
    if math.isnan(atr):
        return None
    value = Decimal(highest_close) - Decimal(str(multiplier)) * Decimal(repr(atr)) * 100
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def at_close(position: Position, close: int, risk: Risk, atr: float) -> None:
    """One more bar held; the highest close and the trailing levels follow this close."""
    position.bars_held += 1
    position.highest_close = max(position.highest_close, close)
    levels: list[int] = []
    if risk.trailing_stop_percent is not None:
        levels.append(percent_of(position.highest_close, 100 - risk.trailing_stop_percent))
    if risk.atr_stop is not None:
        level = atr_level(position.highest_close, risk.atr_stop.multiplier, atr)
        if level is not None:
            levels.append(level)
    for level in levels:
        position.trail = level if position.trail is None else max(position.trail, level)


def stop_level(position: Position, risk: Risk) -> int | None:
    """The highest of the fixed stop (on the average price) and the trailing levels."""
    stop = risk.stop_loss_percent
    fixed = percent_of(position.average, 100 - stop) if stop else None
    levels = [level for level in (fixed, position.trail) if level is not None]
    return max(levels) if levels else None


def held_long_enough(position: Position, risk: Risk) -> bool:
    """`maxHoldBars`: the close where the count is reached queues an exit at the next open."""
    return risk.max_hold_bars is not None and position.bars_held >= risk.max_hold_bars
