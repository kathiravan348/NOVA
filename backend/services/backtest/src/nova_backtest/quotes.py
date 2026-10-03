"""Bid/ask fills for recorded runs (D82 (5)).

Every fill uses the first recorded tick at or after the fill moment: buys at its best ask, sells at
its best bid, its last price when it has no depth. Stops, targets and averaging adds trigger on the
bar as for history runs and fill at the quote of the first tick in that bar whose last price
crosses the level. A tick on another IST day is never used. Each stock's quotes are kept as memory
maps in the run's scratch folder, so memory stays flat however many days a run reads.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import numpy as np
import numpy.typing as npt

Ints = npt.NDArray[np.int64]
Side = Literal["buy", "sell"]
FIELDS = ("ts", "ltp", "bid", "ask")
# Own copies: `columns` imports `tick_bars`, which imports this module.
IST_OFFSET_SECONDS = 5 * 3600 + 30 * 60
DAY_SECONDS = 86_400


@dataclass(frozen=True)
class TickQuotes:
    """One stock's ticks in time order: exchange time (UTC epoch seconds), last price, best bid
    and best ask in paise (0 = no quote)."""

    ts: Ints
    ltp: Ints
    bid: Ints
    ask: Ints

    @classmethod
    def empty(cls) -> "TickQuotes":
        none = np.zeros(0, dtype=np.int64)
        return cls(none, none, none, none)

    @classmethod
    def joined(cls, parts: list["TickQuotes"]) -> "TickQuotes":
        if not parts:
            return cls.empty()
        return cls(*(np.concatenate([getattr(p, f) for p in parts]) for f in FIELDS))


@dataclass(frozen=True)
class Quote:
    price: int  # the fill: ask for a buy, bid for a sell, else the last price
    ltp: int  # the tick's last price (spread cost = |price − ltp| × qty)


def _day_end(t: int) -> int:
    """UTC epoch second of the next IST midnight after `t`."""
    return ((t + IST_OFFSET_SECONDS) // DAY_SECONDS + 1) * DAY_SECONDS - IST_OFFSET_SECONDS


class QuoteBook:
    """The quotes of every stock in a recorded run; `width` = the run's bar size in seconds."""

    def __init__(self, folder: Path, width: int) -> None:
        self.folder, self.width = folder, width
        self.folder.mkdir(parents=True, exist_ok=True)
        self._index: dict[str, int] = {}
        self._open: dict[str, TickQuotes] = {}

    def add(self, symbol: str, quotes: TickQuotes) -> None:
        # Folders by position: symbols such as "M&M" never become file names.
        folder = self.folder / f"{len(self._index):05d}"
        folder.mkdir()
        for name in FIELDS:
            np.save(folder / f"{name}.npy", getattr(quotes, name))
        self._index[symbol] = len(self._index)

    def _quotes(self, symbol: str) -> TickQuotes | None:
        if symbol not in self._index:
            return None
        if symbol not in self._open:
            folder = self.folder / f"{self._index[symbol]:05d}"

            def read(name: str) -> Ints:
                path = folder / f"{name}.npy"
                try:
                    loaded: Ints = np.load(path, mmap_mode="r")
                except ValueError:  # an empty array cannot be memory-mapped
                    loaded = np.load(path)
                return loaded

            self._open[symbol] = TickQuotes(*(read(name) for name in FIELDS))
        return self._open[symbol]

    def close(self) -> None:
        self._open.clear()

    @staticmethod
    def _quote(quotes: TickQuotes, i: int, side: Side) -> Quote:
        ltp = int(quotes.ltp[i])
        best = int(quotes.ask[i] if side == "buy" else quotes.bid[i])
        return Quote(best if best > 0 else ltp, ltp)

    def at(self, symbol: str, t: int, side: Side) -> Quote | None:
        """The first tick at or after `t` on the same IST day; None when there is none."""
        quotes = self._quotes(symbol)
        if quotes is None:
            return None
        i = int(np.searchsorted(quotes.ts, t, side="left"))
        if i >= len(quotes.ts) or int(quotes.ts[i]) >= _day_end(t):
            return None
        return self._quote(quotes, i, side)

    def cross(self, symbol: str, bar_ts: int, level: int, below: bool, side: Side) -> Quote | None:
        """The first tick inside the bar starting at `bar_ts` whose last price is at or below
        (`below`) or at or above `level`; None when no tick crosses."""
        quotes = self._quotes(symbol)
        if quotes is None:
            return None
        lo = int(np.searchsorted(quotes.ts, bar_ts, side="left"))
        hi = int(np.searchsorted(quotes.ts, bar_ts + self.width, side="left"))
        window = np.asarray(quotes.ltp[lo:hi])
        hits = window <= level if below else window >= level
        if not hits.any():
            return None
        return self._quote(quotes, lo + int(np.argmax(hits)), side)
