"""Every stock's bars in time order, one window at a time (D61 (3)).

Bars with the same time arrive together, stocks in name order. A window holds about `window_bars`
bars; its OHLC values become plain Python numbers, which the simulator reads far faster than numpy.
"""

from collections.abc import Iterator
from typing import NamedTuple

import numpy as np

from nova_backtest.scratch import Store


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


def walk(store: Store, window_bars: int = 500_000) -> Iterator[tuple[int, list[BarAt]]]:
    """Yields `(time, bars at that time)` for every bar time of every stock, oldest first."""
    symbols = sorted(store.symbols())
    series = [store.series(s) for s in symbols]
    sizes = [len(s.columns) for s in series]
    position = [0] * len(symbols)
    per_stock = max(1, window_bars // max(1, len(symbols)))
    while True:
        active = [k for k in range(len(symbols)) if position[k] < sizes[k]]
        if not active:
            return
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
                strict=True,
            )
            for j, (ts, o, h, low, close, volume, day, enter, exit_) in enumerate(rows):
                bar = BarAt(
                    symbols[k], position[k] + j, ts, o, h, low, close, volume, day, enter, exit_
                )
                window.append((ts, k, bar))
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
