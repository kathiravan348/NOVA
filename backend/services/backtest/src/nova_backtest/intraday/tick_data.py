"""Recorded ticks for the intraday simulator (D84, `docs/INTRADAY-RESEARCH.md` §3, §7).

Time = the exchange's `exchange_ts` as UTC epoch milliseconds (never `received_at`: the PC clock
drifts); ticks without it are skipped; only 09:15:00 ≤ t < 15:30:00 IST counts; equal times keep
the order they were received in. The base columns (last price, day volume, Kite's session average
price, best bid and ask) are read for every tick; the five depth levels are read only around the
moments a fill is tried: from the Parquet archive they come with the day, from the database in
small windows (most ticks never need them). Each stock-day's base columns live as memory maps in
the run's scratch folder, so memory stays flat however many stocks a day has.
Bars follow the D82 rules: buckets from 09:15 IST, no bar without a tick, volume = change of the
day volume, and a bar is usable only after it closes (`end`).
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

import numpy as np
import numpy.typing as npt
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
from nova_db.models import Instrument, TickDay, TickSession
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from nova_backtest.bars import IST
from nova_backtest.tick_bars import archive_path

Ints = npt.NDArray[np.int64]
LEVELS = 5
BASE = ("ts", "ltp", "volume", "vwap", "bid", "ask")
DEPTH = ("bid_px", "bid_qty", "ask_px", "ask_qty")
SESSION_OPEN, SESSION_CLOSE = time(9, 15), time(15, 30)
MINUTE_MS = 60_000
DEFAULT_TICK_SIZE = 5  # paise, when Kite has not given an instrument's tick size


def session_ms(day: date) -> tuple[int, int]:
    """09:15 and 15:30 IST of `day` as UTC epoch milliseconds."""
    open_, close = (
        datetime.combine(day, t, IST).astimezone(UTC) for t in (SESSION_OPEN, SESSION_CLOSE)
    )
    return int(open_.timestamp()) * 1000, int(close.timestamp()) * 1000


def at_ms(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, UTC)


def ist_ms(day: date, hh_mm: str) -> int:
    """An `HH:MM` IST time of `day` as UTC epoch milliseconds."""
    hours, minutes = (int(part) for part in hh_mm.split(":"))
    moment = datetime.combine(day, time(hours, minutes), IST).astimezone(UTC)
    return int(moment.timestamp()) * 1000


@dataclass(frozen=True)
class Depth:
    """Five levels per tick, best first (rows = ticks); a missing level is 0."""

    bid_px: Ints
    bid_qty: Ints
    ask_px: Ints
    ask_qty: Ints

    @classmethod
    def zeros(cls, rows: int) -> "Depth":
        none = np.zeros((rows, LEVELS), dtype=np.int64)
        return cls(none, none, none, none)


@dataclass(frozen=True)
class DayTicks:
    """One stock's ticks on one day in time order. `bid`/`ask` = best level, 0 = none;
    `vwap` = Kite's session average price, 0 = none. `depth` is set when read with the day."""

    symbol: str
    day: date
    ts: Ints
    ltp: Ints
    volume: Ints
    vwap: Ints
    bid: Ints
    ask: Ints
    depth: Depth | None = None

    def __len__(self) -> int:
        return len(self.ts)

    @classmethod
    def from_arrays(
        cls, symbol: str, day: date, columns: dict[str, Ints], depth: Depth | None = None
    ) -> "DayTicks":
        def column(name: str) -> Ints:
            return np.asarray(columns[name], dtype=np.int64)

        return cls(
            symbol,
            day,
            column("ts"),
            column("ltp"),
            column("volume"),
            column("vwap"),
            column("bid"),
            column("ask"),
            depth,
        )


@dataclass(frozen=True)
class Bars:
    """Bars of one width from one stock-day's ticks. `start`/`end` in epoch ms (`end` = the moment
    the bar is complete), `vwap` = the session average price at the bar's last tick (0 = none),
    `last` = the index of that tick."""

    start: Ints
    end: Ints
    open: Ints
    high: Ints
    low: Ints
    close: Ints
    volume: Ints
    vwap: Ints
    last: Ints

    def __len__(self) -> int:
        return len(self.start)


def build_bars(ticks: DayTicks, width_ms: int) -> Bars:
    open_ms, _ = session_ms(ticks.day)
    if len(ticks) == 0:
        none = np.zeros(0, dtype=np.int64)
        return Bars(none, none, none, none, none, none, none, none, none)
    bucket = (ticks.ts - open_ms) // width_ms
    starts = np.flatnonzero(np.r_[True, bucket[1:] != bucket[:-1]])
    ends = np.r_[starts[1:], len(ticks)] - 1
    volume_at_end = np.maximum.accumulate(ticks.volume)[ends]
    volume = np.diff(np.r_[0, volume_at_end])
    start = open_ms + bucket[starts] * width_ms
    return Bars(
        start=start,
        end=start + width_ms,
        open=ticks.ltp[starts],
        high=np.maximum.reduceat(ticks.ltp, starts),
        low=np.minimum.reduceat(ticks.ltp, starts),
        close=ticks.ltp[ends],
        volume=np.maximum(volume, 0),
        vwap=ticks.vwap[ends],
        last=ends.astype(np.int64),
    )


@dataclass(frozen=True)
class Sessions:
    """Usable sessions (§7) in a period, per stock the days it has ticks, and the skipped days."""

    days: list[date]
    by_symbol: dict[str, list[date]]
    skipped: list[date]


def usable_sessions(
    db: Session, symbols: Iterable[str], first: date, last: date, max_gap_seconds: int
) -> Sessions:
    """Summarized sessions whose longest recorder-wide gap is at most `max_gap_seconds` (a session
    summarized before that number existed is skipped); a stock uses a day only with a `tick_days`
    row."""
    good: list[date] = []
    skipped: list[date] = []
    for day, gap in db.execute(
        select(TickSession.day, TickSession.longest_feed_gap_seconds)
        .where(TickSession.day >= first, TickSession.day <= last)
        .order_by(TickSession.day)
    ):
        (good if gap is not None and gap <= max_gap_seconds else skipped).append(day)
    wanted = list(symbols)
    by_symbol: dict[str, list[date]] = {s: [] for s in wanted}
    if good and wanted:
        for symbol, day in db.execute(
            select(TickDay.symbol, TickDay.day)
            .where(TickDay.exchange == "NSE", TickDay.symbol.in_(wanted), TickDay.day.in_(good))
            .order_by(TickDay.symbol, TickDay.day)
        ):
            by_symbol[symbol].append(day)
    return Sessions(good, by_symbol, skipped)


def tick_sizes(db: Session, symbols: Iterable[str]) -> tuple[dict[str, int], list[str]]:
    """Each stock's tick size in paise; stocks without one get 5 paise and are listed."""
    wanted = list(symbols)
    known: dict[str, int | None] = {
        symbol: size
        for symbol, size in db.execute(
            select(Instrument.symbol, Instrument.tick_size_paise).where(
                Instrument.exchange == "NSE", Instrument.symbol.in_(wanted)
            )
        )
    }
    sizes = {s: known.get(s) or DEFAULT_TICK_SIZE for s in wanted}
    return sizes, sorted(s for s in wanted if not known.get(s))


_DB_BASE = text("""
    SELECT CAST(floor(extract(epoch FROM exchange_ts) * 1000) AS bigint) AS ts,
           last_price_paise AS ltp, volume, COALESCE(avg_price_paise, 0) AS vwap,
           COALESCE(bid_price_paise[1], 0) AS bid, COALESCE(ask_price_paise[1], 0) AS ask
    FROM ticks
    WHERE exchange = 'NSE' AND symbol = :symbol
      AND received_at >= :read_from AND received_at < :read_to
      AND exchange_ts >= :open AND exchange_ts < :close
    ORDER BY exchange_ts, received_at
""")

_DB_DEPTH = text("""
    SELECT bid_price_paise, bid_qty, ask_price_paise, ask_qty
    FROM ticks
    WHERE exchange = 'NSE' AND symbol = :symbol
      AND received_at >= :read_from AND received_at < :read_to
      AND exchange_ts >= :first AND exchange_ts <= :last
    ORDER BY exchange_ts, received_at
""")


def _window(day: date) -> dict[str, datetime]:
    open_ms, close_ms = session_ms(day)
    open_, close = at_ms(open_ms), at_ms(close_ms)
    # The primary key indexes `received_at`: read a margin around the session by it.
    return {
        "open": open_,
        "close": close,
        "read_from": open_ - timedelta(minutes=30),
        "read_to": close + timedelta(minutes=30),
    }


def _levels(values: list[int] | None) -> list[int]:
    row = list(values or [])[:LEVELS]
    return row + [0] * (LEVELS - len(row))


def _epoch_ms(column: pa.ChunkedArray) -> Ints:
    """A `timestamp[us, UTC]` column as epoch milliseconds; nulls become -1 (dropped)."""
    filled = pc.fill_null(pc.cast(column, "int64"), -1)
    micros = np.asarray(filled.to_numpy(zero_copy_only=False), dtype=np.int64)
    return np.where(micros < 0, -1, micros // 1000)


def _int_column(table: pa.Table, name: str) -> Ints:
    filled = pc.fill_null(table.column(name), 0)
    return np.asarray(filled.to_numpy(zero_copy_only=False), dtype=np.int64)


def _level_matrix(column: pa.ChunkedArray) -> Ints:
    out = np.zeros((len(column), LEVELS), dtype=np.int64)
    for level in range(LEVELS):
        values = pc.fill_null(pc.list_element(pc.fill_null(column, pa.scalar([0])), level), 0)
        out[:, level] = np.asarray(values.to_numpy(zero_copy_only=False), dtype=np.int64)
    return out


class TickSource:
    """Reads stock-days from the database, else the Parquet archive; keeps base columns as memory
    maps under `folder` and fetches database depth lazily."""

    def __init__(self, db: Session, archive_root: Path, folder: Path) -> None:
        self.db, self.archive_root, self.folder = db, archive_root, folder
        self.folder.mkdir(parents=True, exist_ok=True)
        self._count = 0

    def _keep(self, ticks: DayTicks) -> DayTicks:
        """The same ticks, base columns memory-mapped from the scratch folder."""
        if len(ticks) == 0:
            return ticks
        folder = self.folder / f"{self._count:06d}"  # never a symbol in a file name ("M&M")
        self._count += 1
        folder.mkdir()
        mapped: dict[str, Ints] = {}
        for name in BASE:
            np.save(folder / f"{name}.npy", getattr(ticks, name))
            mapped[name] = np.load(folder / f"{name}.npy", mmap_mode="r")
        return DayTicks.from_arrays(ticks.symbol, ticks.day, mapped, ticks.depth)

    def load(self, symbol: str, day: date) -> DayTicks:
        rows = self.db.execute(_DB_BASE, {"symbol": symbol, **_window(day)}).all()
        if rows:
            table = np.array(rows, dtype=np.int64)
            columns = {name: table[:, i].copy() for i, name in enumerate(BASE)}
            return self._keep(DayTicks.from_arrays(symbol, day, columns))
        path = archive_path(self.archive_root, day, symbol)
        if not path.exists():
            return DayTicks.from_arrays(symbol, day, {n: np.zeros(0, np.int64) for n in BASE})
        return self._keep(read_parquet(path, symbol, day))

    def depth(self, ticks: DayTicks, lo: int, hi: int) -> tuple[int, Depth]:
        """Depth of ticks `lo`..`hi - 1` (or a slightly wider run of equal times): answers the
        index of the first returned row and the levels."""
        if ticks.depth is not None:
            d = ticks.depth
            return lo, Depth(d.bid_px[lo:hi], d.bid_qty[lo:hi], d.ask_px[lo:hi], d.ask_qty[lo:hi])
        if hi <= lo:
            return lo, Depth.zeros(0)
        first_ms, last_ms = int(ticks.ts[lo]), int(ticks.ts[hi - 1])
        start = int(np.searchsorted(ticks.ts, first_ms, side="left"))
        params = {"symbol": ticks.symbol, "first": at_ms(first_ms), "last": at_ms(last_ms)}
        rows = self.db.execute(_DB_DEPTH, params | _window(ticks.day)).all()
        if not rows:
            return start, Depth.zeros(0)
        return start, Depth(
            np.array([_levels(r.bid_price_paise) for r in rows], dtype=np.int64),
            np.array([_levels(r.bid_qty) for r in rows], dtype=np.int64),
            np.array([_levels(r.ask_price_paise) for r in rows], dtype=np.int64),
            np.array([_levels(r.ask_qty) for r in rows], dtype=np.int64),
        )


def read_parquet(path: Path, symbol: str, day: date) -> DayTicks:
    """One archived stock-day with its depth (the archive keeps every tick field, D77)."""
    names = ["exchange", "exchange_ts", "received_at", "last_price_paise", "volume"]
    extra = ["avg_price_paise", "bid_price_paise", "bid_qty", "ask_price_paise", "ask_qty"]
    table = pq.read_table(path, columns=names + extra)
    ts = _epoch_ms(table.column("exchange_ts"))
    received = _epoch_ms(table.column("received_at"))
    open_ms, close_ms = session_ms(day)
    keep = (np.array(table.column("exchange").to_pylist()) == "NSE") & (ts >= open_ms)
    keep &= ts < close_ms
    order = np.lexsort((received[keep], ts[keep]))
    rows = np.flatnonzero(keep)[order]
    bid_px = _level_matrix(table.column("bid_price_paise"))[rows]
    ask_px = _level_matrix(table.column("ask_price_paise"))[rows]
    columns = {
        "ts": ts[rows],
        "ltp": _int_column(table, "last_price_paise")[rows],
        "volume": _int_column(table, "volume")[rows],
        "vwap": _int_column(table, "avg_price_paise")[rows],
        "bid": bid_px[:, 0].copy(),
        "ask": ask_px[:, 0].copy(),
    }
    depth = Depth(
        bid_px,
        _level_matrix(table.column("bid_qty"))[rows],
        ask_px,
        _level_matrix(table.column("ask_qty"))[rows],
    )
    return DayTicks.from_arrays(symbol, day, columns, depth)
