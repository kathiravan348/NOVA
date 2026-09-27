"""Every stock's bars in time order, one window at a time (D61 (3)).

Bars with the same time arrive together, stocks in name order. A window holds about `window_bars`
bars; its OHLC values become plain Python numbers, which the simulator reads far faster than numpy.
"""

import itertools
import math
from collections.abc import Iterator
from typing import NamedTuple

import numpy as np

from nova_backtest.scratch import Store, StoredSeries

REMAP_WINDOWS = 16


class BarAt(NamedTuple):
    symbol: str
    i: int  # index of the bar in its stock's series
    ts: int  # UTC epoch seconds
    open: int
    high: int
    low: int
    close: int
    volume: int
    day: int  # IST day number
    enter: bool
    exit: bool
    rank: float  # NaN when the run ranks nothing (D62)
    atr: float  # NaN when the run has no ATR stop (D62)


def walk(store: Store, window_bars: int = 500_000) -> Iterator[tuple[int, list[BarAt]]]:
    """Yields `(time, bars at that time)` for every bar time of every stock, oldest first."""
    symbols = sorted(store.symbols())
    sizes = [len(store.series(s).columns) for s in symbols]
    position = [0] * len(symbols)
    per_stock = max(1, window_bars // max(1, len(symbols)))
    series: dict[int, StoredSeries] = {}
    for number in itertools.count():
        active = [k for k in range(len(symbols)) if position[k] < sizes[k]]
        if not active:
            return
        if number % REMAP_WINDOWS == 0:
            # Fresh memory maps now and then: pages already read are let go with the old ones.
            series = {k: store.series(symbols[k]) for k in active}
        # The earliest time at which some stock would pass its share of the window.
        end = min(
            int(series[k].columns.ts[min(position[k] + per_stock, sizes[k]) - 1]) for k in active
        )
        window: list[tuple[int, int, BarAt]] = []
        for k in active:
            s = series[k]
            stop = int(np.searchsorted(s.columns.ts, end, side="right"))
            if stop <= position[k]:
                continue
            part = slice(position[k], stop)
            c = s.columns
            blank = [math.nan] * (stop - position[k])
            rows = zip(
                c.ts[part].tolist(),
                c.open[part].tolist(),
                c.high[part].tolist(),
                c.low[part].tolist(),
                c.close[part].tolist(),
                c.volume[part].tolist(),
                c.day[part].tolist(),
                s.enter[part].tolist(),
                s.exit[part].tolist(),
                blank if s.rank is None else s.rank[part].tolist(),
                blank if s.atr is None else s.atr[part].tolist(),
                strict=True,
            )
            for j, row in enumerate(rows):
                bar = BarAt(symbols[k], position[k] + j, *row)
                window.append((bar.ts, k, bar))
            position[k] = stop
        window.sort(key=lambda row: (row[0], row[1]))
        group: list[BarAt] = []
        current: int | None = None
        for ts, _, bar in window:
            if ts != current and group:
                assert current is not None
                yield current, group
                group = []
            current = ts
            group.append(bar)
        if group and current is not None:
            yield current, group
