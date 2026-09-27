"""Where pass 1 leaves each stock's columns and signals for pass 2 (D61 (3)).

`RunScratch` keeps them as numpy files in a per-run folder and reads them back memory-mapped, so a
run's memory does not grow with its size. `MemoryStore` holds the same in memory (tests).
"""

import gc
import shutil
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol, Self

import numpy as np
import numpy.typing as npt

from nova_backtest.bars import Bar
from nova_backtest.columns import Columns

Bools = npt.NDArray[np.bool_]
Floats = npt.NDArray[np.float64]
FIELDS = ("ts", "open", "high", "low", "close", "volume", "day")


@dataclass(frozen=True)
class StoredSeries:
    columns: Columns
    enter: Bools
    exit: Bools
    rank: Floats | None = None  # `portfolio.rank` or the rotation score at each close (D62)
    atr: Floats | None = None  # ATR of `risk.atrStop` at each close (D62), NaN = none
    regime: Bools | None = None  # the market filter at each close (D62); None = always on


class Store(Protocol):
    def symbols(self) -> list[str]:
        """Every stock of the run, in the order it was added."""

    def series(self, symbol: str) -> StoredSeries: ...


class Signals(Protocol):
    """Whether a strategy wants in or out at the close of bar `i` of `symbol`."""

    def enter(self, symbol: str, i: int) -> bool: ...

    def exit(self, symbol: str, i: int) -> bool: ...


class MemoryStore:
    def __init__(self) -> None:
        self._series: dict[str, StoredSeries] = {}

    def add(
        self,
        symbol: str,
        columns: Columns,
        enter: Bools,
        exit_: Bools,
        rank: Floats | None = None,
        atr: Floats | None = None,
        regime: Bools | None = None,
    ) -> None:
        self._series[symbol] = StoredSeries(columns, enter, exit_, rank, atr, regime)

    def symbols(self) -> list[str]:
        return list(self._series)

    def series(self, symbol: str) -> StoredSeries:
        return self._series[symbol]

    @classmethod
    def from_bars(
        cls,
        bars: Mapping[str, Sequence[Bar]],
        signals: Signals,
        ranks: Mapping[str, Sequence[float]] | None = None,
        atrs: Mapping[str, Sequence[float]] | None = None,
        regimes: Mapping[str, Sequence[bool]] | None = None,
    ) -> Self:
        """Bar lists, per-bar `enter`/`exit` answers, optional rank and ATR values (tests)."""

        def floats(values: Mapping[str, Sequence[float]] | None, symbol: str) -> Floats | None:
            return None if values is None else np.array(values[symbol], dtype=np.float64)

        store = cls()
        for symbol, series in bars.items():
            count = range(len(series))
            store.add(
                symbol,
                Columns.from_bars(series),
                np.array([signals.enter(symbol, i) for i in count], dtype=np.bool_),
                np.array([signals.exit(symbol, i) for i in count], dtype=np.bool_),
                floats(ranks, symbol),
                floats(atrs, symbol),
                None if regimes is None else np.array(regimes[symbol], dtype=np.bool_),
            )
        return store


class RunScratch:
    """A run's folder under `root`; removed by `close()` (also after a failure)."""

    def __init__(self, root: Path, run_id: str) -> None:
        self.path = root / run_id
        self.path.mkdir(parents=True, exist_ok=True)
        self._symbols: list[str] = []

    def _folder(self, index: int) -> Path:
        # Folders by position: symbols such as "M&M" or "NIFTY 50" never become file names.
        return self.path / f"{index:05d}"

    def add(
        self,
        symbol: str,
        columns: Columns,
        enter: Bools,
        exit_: Bools,
        rank: Floats | None = None,
        atr: Floats | None = None,
        regime: Bools | None = None,
    ) -> None:
        folder = self._folder(len(self._symbols))
        folder.mkdir()
        for field in FIELDS:
            np.save(folder / f"{field}.npy", getattr(columns, field))
        np.save(folder / "enter.npy", enter)
        np.save(folder / "exit.npy", exit_)
        for name, values in (("rank", rank), ("atr", atr), ("regime", regime)):
            if values is not None:
                np.save(folder / f"{name}.npy", values)
        self._symbols.append(symbol)

    def symbols(self) -> list[str]:
        return list(self._symbols)

    def series(self, symbol: str) -> StoredSeries:
        """New read-only memory maps on every call; they are unmapped once dropped."""
        folder = self._folder(self._symbols.index(symbol))

        def read(name: str) -> Any:  # Any: each file's own dtype (int64, int32 or bool)
            path = folder / f"{name}.npy"
            try:
                return np.load(path, mmap_mode="r")
            except ValueError:  # an empty array cannot be memory-mapped
                return np.load(path)

        def optional(name: str) -> Any:  # Any: float64 array
            return read(name) if (folder / f"{name}.npy").exists() else None

        columns = Columns(*(read(field) for field in FIELDS))
        return StoredSeries(
            columns,
            read("enter"),
            read("exit"),
            optional("rank"),
            optional("atr"),
            optional("regime"),
        )

    def close(self) -> None:
        """Removes the folder; maps still open are collected first (Windows cannot delete them)."""
        gc.collect()
        shutil.rmtree(self.path, ignore_errors=True)


def clear_all(root: Path) -> None:
    """Removes every run folder left by a stopped worker (D61 (3))."""
    if root.exists():
        for child in root.iterdir():
            shutil.rmtree(child, ignore_errors=True)
