"""Candles built from recorded ticks for `recorded` backtests (D82 (3), (4)).

Price = `last_price_paise`, time = the exchange's `exchange_ts` (never `received_at`: the PC clock
drifts); ticks without an exchange time are skipped. Only 09:15:00 ≤ t < 15:30:00 IST counts and
buckets start at 09:15 IST. A bucket with no tick has no bar. Bar volume = the day's running volume
at the bar's last tick minus the same at the previous bar's last tick (the first bar: minus 0).
Ticks come from the database, or from the Parquet archive when the database has none that day.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

import numpy as np
import numpy.typing as npt
import pyarrow.compute as pc
import pyarrow.parquet as pq
from nova_db.candles import BarRow
from nova_db.models import TickDay, TickSession
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from nova_backtest.bars import IST

Ints = npt.NDArray[np.int64]
SESSION_OPEN, SESSION_CLOSE = time(9, 15), time(15, 30)
# A day whose feed was down longer than this is skipped (D82 (4)).
RECORDED_MAX_GAP_SECONDS = 300

WIDTHS = {
    "1s": 1,
    "5s": 5,
    "15s": 15,
    "30s": 30,
    "1m": 60,
    "3m": 180,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
}


def timeframe_seconds(timeframe: str) -> int:
    """Bar width in seconds of an intraday timeframe; `ValueError` for `1d` or unknown."""
    try:
        return WIDTHS[timeframe]
    except KeyError:
        raise ValueError(f"Recorded data has no {timeframe} candles") from None


@dataclass(frozen=True)
class UsableDays:
    """Per stock the days it may use, and the summarized days skipped for a feed gap."""

    by_symbol: dict[str, list[date]]
    sessions: list[date]
    skipped: list[date]


def usable_days(
    db: Session, exchange: str, symbols: Iterable[str], first: date, last: date
) -> UsableDays:
    """Summarized sessions in [first, last]; a stock uses a session only with a `tick_days` row."""
    good: list[date] = []
    skipped: list[date] = []
    for day, gap in db.execute(
        select(TickSession.day, TickSession.feed_gap_seconds)
        .where(TickSession.day >= first, TickSession.day <= last)
        .order_by(TickSession.day)
    ):
        (good if gap <= RECORDED_MAX_GAP_SECONDS else skipped).append(day)
    wanted = list(symbols)
    by_symbol: dict[str, list[date]] = {s: [] for s in wanted}
    if good and wanted:
        for symbol, day in db.execute(
            select(TickDay.symbol, TickDay.day)
            .where(
                TickDay.exchange == exchange,
                TickDay.symbol.in_(wanted),
                TickDay.day.in_(good),
            )
            .order_by(TickDay.symbol, TickDay.day)
        ):
            by_symbol[symbol].append(day)
    return UsableDays(by_symbol, good, skipped)


def _session(day: date) -> tuple[datetime, datetime]:
    return (
        datetime.combine(day, SESSION_OPEN, IST).astimezone(UTC),
        datetime.combine(day, SESSION_CLOSE, IST).astimezone(UTC),
    )


_DB_BARS = text("""
    SELECT time_bucket(make_interval(secs => :width), exchange_ts, CAST(:open AS timestamptz))
             AS ts,
           (array_agg(last_price_paise ORDER BY exchange_ts, received_at))[1] AS open,
           max(last_price_paise) AS high,
           min(last_price_paise) AS low,
           (array_agg(last_price_paise ORDER BY exchange_ts DESC, received_at DESC))[1] AS close,
           (array_agg(volume ORDER BY exchange_ts DESC, received_at DESC))[1] AS day_volume
    FROM ticks
    WHERE exchange = :exchange AND symbol = :symbol
      AND received_at >= :read_from AND received_at < :read_to
      AND exchange_ts >= :open AND exchange_ts < :close
    GROUP BY 1 ORDER BY 1
""")


def _with_volume(rows: list[tuple[datetime, int, int, int, int, int]]) -> list[BarRow]:
    out: list[BarRow] = []
    before = 0
    for ts, open_, high, low, close, day_volume in rows:
        out.append(BarRow(ts, open_, high, low, close, max(int(day_volume) - before, 0)))
        before = max(before, int(day_volume))
    return out


def _db_bars(db: Session, exchange: str, symbol: str, width: int, day: date) -> list[BarRow]:
    open_, close = _session(day)
    params = {
        "width": width,
        "exchange": exchange,
        "symbol": symbol,
        "open": open_,
        "close": close,
        # The primary key indexes `received_at`: read a margin around the session by it.
        "read_from": open_ - timedelta(minutes=30),
        "read_to": close + timedelta(minutes=30),
    }
    rows = [
        (r.ts, r.open, r.high, r.low, r.close, r.day_volume) for r in db.execute(_DB_BARS, params)
    ]
    return _with_volume(rows)


def archive_path(root: Path, day: date, symbol: str) -> Path:
    """Same layout as the Atlas archive (D49)."""
    return root / f"date={day.isoformat()}" / f"symbol={symbol}" / "ticks.parquet"


def _epoch_us(column: object) -> Ints:
    """A `timestamp[us, UTC]` column as int64 epoch microseconds; nulls become -1 (dropped)."""
    filled = pc.fill_null(pc.cast(column, "int64"), -1)
    return np.asarray(filled.to_numpy(zero_copy_only=False), dtype=np.int64)


def _parquet_bars(path: Path, exchange: str, width: int, day: date) -> list[BarRow]:
    table = pq.read_table(
        path, columns=["exchange", "exchange_ts", "received_at", "last_price_paise", "volume"]
    )
    exchanges = table.column("exchange").to_pylist()
    at = _epoch_us(table.column("exchange_ts"))
    received = _epoch_us(table.column("received_at"))
    price = np.asarray(table.column("last_price_paise").to_numpy(), dtype=np.int64)
    volume = np.asarray(table.column("volume").to_numpy(), dtype=np.int64)
    open_, close = (int(t.timestamp()) * 1_000_000 for t in _session(day))
    keep = (np.array(exchanges) == exchange) & (at >= open_) & (at < close)
    at, received, price, volume = at[keep], received[keep], price[keep], volume[keep]
    if len(at) == 0:
        return []
    order = np.lexsort((received, at))
    at, price, volume = at[order], price[order], volume[order]
    bucket = (at - open_) // (width * 1_000_000)
    starts = np.flatnonzero(np.r_[True, bucket[1:] != bucket[:-1]])
    ends = np.r_[starts[1:], len(at)] - 1
    highs = np.maximum.reduceat(price, starts)
    lows = np.minimum.reduceat(price, starts)
    rows = [
        (
            datetime.fromtimestamp(open_ / 1_000_000 + int(bucket[s]) * width, UTC),
            int(price[s]),
            int(hi),
            int(lo),
            int(price[e]),
            int(volume[e]),
        )
        for s, e, hi, lo in zip(starts, ends, highs, lows, strict=True)
    ]
    return _with_volume(rows)


def read_tick_bars(
    db: Session, archive_root: Path, exchange: str, symbol: str, timeframe: str, day: date
) -> list[BarRow]:
    """One stock's candles for one day: database first, else the Parquet archive, else none."""
    width = timeframe_seconds(timeframe)
    bars = _db_bars(db, exchange, symbol, width, day)
    if bars:
        return bars
    path = archive_path(archive_root, day, symbol)
    return _parquet_bars(path, exchange, width, day) if path.exists() else []
