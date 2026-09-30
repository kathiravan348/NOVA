"""Bounded tick reads from PostgreSQL and the existing Parquet archive (D49, D74)."""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pyarrow.parquet as pq
from sqlalchemy import text
from sqlalchemy.orm import Session

IST = ZoneInfo("Asia/Kolkata")
SESSION_SECONDS = 22_500


def midnight(day: date) -> datetime:
    return datetime.combine(day, time(), IST).astimezone(UTC)


def session_window(day: date, now: datetime) -> tuple[int, int]:
    start = datetime.combine(day, time(9, 15), IST).astimezone(UTC)
    if day.weekday() >= 5 or now < start:
        return int(start.timestamp()), 0
    expected = min(SESSION_SECONDS, max(0, int((now - start).total_seconds()) + 1))
    return int(start.timestamp()), expected


@dataclass
class StockDay:
    count: int = 0
    size: int = 0
    seconds: set[int] = field(default_factory=set)
    at: datetime | None = None
    price: int | None = None


_STATS = text("""
    SELECT symbol, count(*) AS ticks, sum(pg_column_size(t)) AS bytes,
           max(received_at) AS at, last(last_price_paise, received_at) AS price,
           array_agg(DISTINCT date_trunc('second', received_at))
             FILTER (WHERE received_at >= :open AND received_at < :close) AS seconds
    FROM ticks t WHERE exchange = 'NSE' AND symbol = ANY(:symbols)
      AND received_at >= :start AND received_at < :end AND received_at <= :now
    GROUP BY symbol
""")
_ACTIVE = text("""
    SELECT DISTINCT date_trunc('second', received_at) AS second FROM ticks
    WHERE exchange = 'NSE' AND received_at >= :open AND received_at < :close
      AND received_at <= :now
""")


def day_data(
    db: Session,
    root: Path,
    day: date,
    symbols: list[str],
    now: datetime,
) -> tuple[dict[str, StockDay], set[int], int]:
    """All-stock activity is a union of at most 22,500 seconds, not a tick-sized list."""
    start, expected = session_window(day, now)
    params = {
        "symbols": symbols,
        "start": midnight(day),
        "end": midnight(day + timedelta(days=1)),
        "open": datetime.fromtimestamp(start, UTC),
        "close": datetime.fromtimestamp(start + expected, UTC),
        "now": now,
    }
    own = {symbol: StockDay() for symbol in symbols}
    in_db: set[str] = set()
    for row in db.execute(_STATS, params):
        in_db.add(row.symbol)
        own[row.symbol] = StockDay(
            row.ticks,
            row.bytes,
            {int(at.timestamp()) for at in row.seconds or []},
            row.at,
            row.price,
        )
    active = {int(row.second.timestamp()) for row in db.execute(_ACTIVE, params)}
    directory = root / f"date={day.isoformat()}"
    for path in directory.glob("symbol=*/ticks.parquet"):
        symbol = path.parent.name.removeprefix("symbol=")
        target = own.get(symbol) if symbol not in in_db else None
        if target is not None:
            target.size += path.stat().st_size
        # Column projection + batches keep memory bounded even for 500 recorded stocks.
        archive = pq.ParquetFile(path)
        for batch in archive.iter_batches(
            batch_size=32_768, columns=["exchange", "received_at", "last_price_paise"]
        ):
            exchanges = batch.column(0).to_pylist()
            stamps = batch.column(1).to_pylist()
            prices = batch.column(2).to_pylist()
            for exchange, at, price in zip(exchanges, stamps, prices, strict=True):
                if exchange != "NSE" or at > now or at.astimezone(IST).date() != day:
                    continue
                second = int(at.timestamp())
                if start <= second < start + expected:
                    active.add(second)
                    if target is not None:
                        target.seconds.add(second)
                if target is not None:
                    target.count += 1
                    if target.at is None or at > target.at:
                        target.at, target.price = at, price
    return own, active, expected


def recorded_days(db: Session, root: Path, now: datetime) -> list[date]:
    days = set(
        db.scalars(
            text(
                "SELECT DISTINCT (received_at AT TIME ZONE 'Asia/Kolkata')::date"
                " FROM ticks WHERE exchange = 'NSE' AND received_at <= :now"
            ),
            {"now": now},
        )
    )
    for directory in root.glob("date=*"):
        try:
            day = date.fromisoformat(directory.name.removeprefix("date="))
        except ValueError:
            continue
        if day <= now.astimezone(IST).date() and any(directory.glob("symbol=*/ticks.parquet")):
            days.add(day)
    return sorted(days, reverse=True)


def snapshot_seconds(
    db: Session, root: Path, symbols: list[str], now: datetime
) -> tuple[dict[str, int], int]:
    """500-stock snapshots return counts, never 500 full arrays of receive seconds."""
    day = now.astimezone(IST).date()
    start, expected = session_window(day, now)
    params = {
        "symbols": symbols,
        "start": midnight(day),
        "end": midnight(day + timedelta(days=1)),
        "open": datetime.fromtimestamp(start, UTC),
        "close": datetime.fromtimestamp(start + expected, UTC),
        "now": now,
    }
    query = text("""
        SELECT symbol, count(DISTINCT date_trunc('second', received_at))
          FILTER (WHERE received_at >= :open AND received_at < :close) AS seconds
        FROM ticks WHERE exchange = 'NSE' AND symbol = ANY(:symbols)
          AND received_at >= :start AND received_at < :end AND received_at <= :now
        GROUP BY symbol
    """)
    counts = {row.symbol: row.seconds for row in db.execute(query, params)}
    for symbol in symbols:
        if symbol in counts:
            continue
        path = root / f"date={day.isoformat()}" / f"symbol={symbol}" / "ticks.parquet"
        if not path.is_file():
            continue
        seconds: set[int] = set()
        for batch in pq.ParquetFile(path).iter_batches(columns=["exchange", "received_at"]):
            for exchange, at in zip(*(col.to_pylist() for col in batch.columns), strict=True):
                second = int(at.timestamp())
                if exchange == "NSE" and at <= now and start <= second < start + expected:
                    seconds.add(second)
        counts[symbol] = len(seconds)
    return counts, expected


def latest_ticks(db: Session, root: Path, symbols: list[str], now: datetime) -> dict[str, StockDay]:
    query = text(
        "SELECT DISTINCT ON (symbol) symbol, received_at, last_price_paise FROM ticks"
        " WHERE exchange = 'NSE' AND symbol = ANY(:symbols) AND received_at <= :now"
        " ORDER BY symbol, received_at DESC"
    )
    latest = {
        row.symbol: StockDay(at=row.received_at, price=row.last_price_paise)
        for row in db.execute(query, {"symbols": symbols, "now": now})
    }
    # Only a stock's newest archive can improve its latest price; never scan years of tick rows.
    days = recorded_days(db, root, now)
    for symbol in symbols:
        for day in days:
            current = latest.get(symbol)
            if (
                current is not None
                and current.at is not None
                and current.at.astimezone(IST).date() > day
            ):
                break
            path = root / f"date={day.isoformat()}" / f"symbol={symbol}" / "ticks.parquet"
            if not path.is_file():
                continue
            for batch in pq.ParquetFile(path).iter_batches(
                columns=["exchange", "received_at", "last_price_paise"]
            ):
                for exchange, at, price in zip(
                    *(col.to_pylist() for col in batch.columns), strict=True
                ):
                    if (
                        exchange == "NSE"
                        and at <= now
                        and (current is None or current.at is None or at > current.at)
                    ):
                        current = StockDay(at=at, price=price)
                        latest[symbol] = current
            if current is not None:
                break
    return latest
