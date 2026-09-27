"""Volume indicators (D51): on-balance volume, money flow index, volume SMA. (VWAP is in core.)"""

from nova_backtest.columns import Columns
from nova_backtest.indicators_core import Series, rupees, sma


def obv(bars: Columns) -> Series:
    """Starts at 0; adds the volume on an up close, subtracts it on a down close."""
    out: Series = []
    total = 0.0
    closes: list[int] = bars.close.tolist()
    volumes: list[int] = bars.volume.tolist()
    for i, (close, volume) in enumerate(zip(closes, volumes, strict=True)):
        if i and close > closes[i - 1]:
            total += volume
        elif i and close < closes[i - 1]:
            total -= volume
        out.append(total)
    return out


def mfi(bars: Columns, period: int) -> Series:
    """100 − 100 / (1 + positive flow / negative flow) over `period` bars; no negative flow → 100.

    Flow = typical price × volume, positive when the typical price rose, negative when it fell.
    """
    highs, lows, closes = rupees(bars)
    typical = [(h + low + c) / 3 for h, low, c in zip(highs, lows, closes, strict=True)]
    volumes: list[int] = bars.volume.tolist()
    positive, negative = [0.0], [0.0]
    for i in range(1, len(bars)):
        flow = typical[i] * volumes[i]
        positive.append(flow if typical[i] > typical[i - 1] else 0.0)
        negative.append(flow if typical[i] < typical[i - 1] else 0.0)
    out: Series = [None] * len(bars)
    for i in range(period, len(bars)):
        up, down = sum(positive[i - period + 1 : i + 1]), sum(negative[i - period + 1 : i + 1])
        out[i] = 100.0 if down == 0 else 100 - 100 / (1 + up / down)
    return out


def volume_sma(bars: Columns, period: int) -> Series:
    return sma([float(v) for v in bars.volume.tolist()], period)
