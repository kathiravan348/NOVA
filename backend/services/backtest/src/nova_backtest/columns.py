"""Bars as numpy columns (D61): one stock at a time, far smaller than one Python object per bar."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from pathlib import Path
from typing import Self

import numpy as np
import numpy.typing as npt
from nova_db.candles import BarRow, read_bars
from sqlalchemy.orm import Session

from nova_backtest.bars import IST, Bar
from nova_backtest.tick_bars import read_tick_bars

Ints = npt.NDArray[np.int64]
IST_OFFSET_SECONDS = 5 * 3600 + 30 * 60
DAY_SECONDS = 86_400


def ist_days(ts: Ints) -> npt.NDArray[np.int32]:
    """IST calendar day of each UTC epoch second, as days since 1970-01-01 (IST has no DST)."""
    return ((ts + IST_OFFSET_SECONDS) // DAY_SECONDS).astype(np.int32)


@dataclass(frozen=True)
class Columns:
    """One stock's bars: UTC epoch seconds, prices in paise, volume, and the IST day of each bar."""

    ts: Ints
    open: Ints
    high: Ints
    low: Ints
    close: Ints
    volume: Ints
    day: npt.NDArray[np.int32]
    timeframe: str = "1d"  # bar size: the opening range and volatility need it (D62)

    def __len__(self) -> int:
        return len(self.ts)

    @classmethod
    def from_arrays(
        cls,
        ts: Ints,
        open_: Ints,
        high: Ints,
        low: Ints,
        close: Ints,
        volume: Ints,
        timeframe: str = "1d",
    ) -> Self:
        return cls(ts, open_, high, low, close, volume, ist_days(ts), timeframe)

    @classmethod
    def from_bars(cls, bars: Sequence[Bar], timeframe: str = "1d") -> Self:
        def column(values: list[int]) -> Ints:
            return np.array(values, dtype=np.int64)

        return cls.from_arrays(
            column([int(b.ts.timestamp()) for b in bars]),
            column([b.open for b in bars]),
            column([b.high for b in bars]),
            column([b.low for b in bars]),
            column([b.close for b in bars]),
            column([b.volume for b in bars]),
            timeframe,
        )

    def time(self, i: int) -> datetime:
        return datetime.fromtimestamp(int(self.ts[i]), UTC)

    def to_bars(self) -> list[Bar]:
        """`Bar` objects for the simulator until it reads columns itself (NOVA-110)."""
        return [
            Bar(datetime.fromtimestamp(t, UTC), o, h, low, c, v)
            for t, o, h, low, c, v in zip(
                self.ts.tolist(),
                self.open.tolist(),
                self.high.tolist(),
                self.low.tolist(),
                self.close.tolist(),
                self.volume.tolist(),
                strict=True,
            )
        ]


def _ist_midnight(day: date) -> datetime:
    return datetime.combine(day, time(0, 0), tzinfo=IST).astimezone(UTC)


def _windows(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    """[start, end) cut at IST new-year midnights, so a rolled-up bucket never straddles two."""
    cuts = [start]
    year = start.astimezone(IST).year + 1
    while (cut := _ist_midnight(date(year, 1, 1))) < end:
        cuts.append(cut)
        year += 1
    cuts.append(end)
    return [(a, b) for a, b in zip(cuts, cuts[1:], strict=False) if a < b]


def _append(parts: list[list[Ints]], rows: Sequence[BarRow]) -> None:
    values = (
        [int(r.ts.timestamp()) for r in rows],
        [r.open_paise for r in rows],
        [r.high_paise for r in rows],
        [r.low_paise for r in rows],
        [r.close_paise for r in rows],
        [r.volume for r in rows],
    )
    for k, column in enumerate(values):
        parts[k].append(np.array(column, dtype=np.int64))


def _joined(parts: list[list[Ints]], timeframe: str) -> Columns:
    def joined(k: int) -> Ints:
        return np.concatenate(parts[k]) if parts[k] else np.zeros(0, dtype=np.int64)

    ts, open_, high, low, close, volume = (joined(k) for k in range(6))
    return Columns.from_arrays(ts, open_, high, low, close, volume, timeframe)


def load(
    db: Session, exchange: str, symbol: str, timeframe: str, start: datetime, end: datetime
) -> Columns:
    """Bars with `start <= ts < end`, read one calendar year at a time (D61 (2))."""
    parts: list[list[Ints]] = [[] for _ in range(6)]
    for a, b in _windows(start, end):
        rows = read_bars(db, exchange, symbol, timeframe, a, b)
        _append(parts, rows)
        del rows
    return _joined(parts, timeframe)


def load_recorded(
    db: Session,
    archive_root: Path,
    exchange: str,
    symbol: str,
    timeframe: str,
    days: Sequence[date],
) -> Columns:
    """Candles built from recorded ticks, one usable day at a time (D82 (3))."""
    parts: list[list[Ints]] = [[] for _ in range(6)]
    for day in days:
        _append(parts, read_tick_bars(db, archive_root, exchange, symbol, timeframe, day))
    return _joined(parts, timeframe)
