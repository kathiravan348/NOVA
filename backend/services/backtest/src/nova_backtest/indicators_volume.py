"""Volume indicators (D51): on-balance volume, money flow index, volume SMA. (VWAP is in core.)"""

from collections.abc import Sequence

from nova_backtest.bars import Bar
from nova_backtest.indicators_core import Series, rupees, sma


def obv(bars: Sequence[Bar]) -> Series:
    """Starts at 0; adds the volume on an up close, subtracts it on a down close."""
    out: Series = []
    total = 0.0
    for i, bar in enumerate(bars):
        if i and bar.close > bars[i - 1].close:
            total += bar.volume
        elif i and bar.close < bars[i - 1].close:
            total -= bar.volume
        out.append(total)
    return out


def mfi(bars: Sequence[Bar], period: int) -> Series:
    """100 − 100 / (1 + positive flow / negative flow) over `period` bars; no negative flow → 100.

    Flow = typical price × volume, positive when the typical price rose, negative when it fell.
    """
    highs, lows, closes = rupees(bars)
    typical = [(h + low + c) / 3 for h, low, c in zip(highs, lows, closes, strict=True)]
    positive, negative = [0.0], [0.0]
    for i in range(1, len(bars)):
        flow = typical[i] * bars[i].volume
        positive.append(flow if typical[i] > typical[i - 1] else 0.0)
        negative.append(flow if typical[i] < typical[i - 1] else 0.0)
    out: Series = [None] * len(bars)
    for i in range(period, len(bars)):
        up, down = sum(positive[i - period + 1 : i + 1]), sum(negative[i - period + 1 : i + 1])
        out[i] = 100.0 if down == 0 else 100 - 100 / (1 + up / down)
    return out


def volume_sma(bars: Sequence[Bar], period: int) -> Series:
    return sma([float(bar.volume) for bar in bars], period)
