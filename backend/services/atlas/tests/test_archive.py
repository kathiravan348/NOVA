"""Tick archive to Parquet (D49)."""

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from nova_atlas import archive
from nova_atlas.archive import archive_ticks, read_ticks, tick_path
from nova_db.models import Tick
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

DAY1 = datetime(2026, 9, 21, 4, 0, tzinfo=UTC)  # 09:30 IST
DAY2 = DAY1 + timedelta(days=1)


@pytest.fixture
def db(session: Session) -> Session:
    session.execute(text("DELETE FROM ticks"))
    session.commit()
    return session


def tick(symbol: str, at: datetime, price: int, oi: int | None = None) -> Tick:
    return Tick(
        exchange="NSE",
        symbol=symbol,
        received_at=at,
        exchange_ts=at,
        last_price_paise=price,
        last_qty=1,
        volume=10,
        oi=oi,
    )


def seed(db: Session) -> None:
    db.add_all(
        [
            tick("INFY", DAY1, 100),
            tick("INFY", DAY1 + timedelta(seconds=1), 101, oi=5),
            tick("TCS", DAY1, 300),
            tick("INFY", DAY2, 102),
        ]
    )
    db.commit()


def count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Tick)) or 0


def test_round_trip_and_delete(db: Session, tmp_path: Path) -> None:
    seed(db)
    written = archive_ticks(db, tmp_path, date(2026, 9, 22))
    assert written == [tick_path(tmp_path, date(2026, 9, 21), s) for s in ("INFY", "TCS")]
    rows = read_ticks(written[0])
    assert [(r["symbol"], r["last_price_paise"], r["oi"]) for r in rows] == [
        ("INFY", 100, None),
        ("INFY", 101, 5),
    ]
    assert rows[0]["received_at"] == DAY1
    assert count(db) == 1  # DAY2 stays


def test_several_days_then_nothing_left(db: Session, tmp_path: Path) -> None:
    seed(db)
    assert len(archive_ticks(db, tmp_path, date(2026, 9, 23))) == 3
    assert count(db) == 0
    assert archive_ticks(db, tmp_path, date(2026, 9, 23)) == []


def test_never_overwrites(db: Session, tmp_path: Path) -> None:
    seed(db)
    existing = tick_path(tmp_path, date(2026, 9, 21), "TCS")
    existing.parent.mkdir(parents=True)
    existing.write_bytes(b"keep")
    with pytest.raises(ValueError, match="not overwriting"):
        archive_ticks(db, tmp_path, date(2026, 9, 22))
    assert existing.read_bytes() == b"keep"
    assert count(db) == 4
    assert not tick_path(tmp_path, date(2026, 9, 21), "INFY").exists()


def test_every_kite_field_round_trips(db: Session, tmp_path: Path) -> None:
    """Depth, day OHLC and trade time reach the Parquet file unchanged (D77)."""
    full = tick("INFY", DAY1, 100)
    full.close_paise, full.last_trade_ts = 99, DAY1 - timedelta(seconds=2)
    full.bid_price_paise, full.bid_orders = [100, 99, 98, 97, 96], [1, 2, 3, 4, 5]
    db.add_all([full, tick("INFY", DAY1 + timedelta(seconds=1), 101)])
    db.commit()
    (path,) = archive_ticks(db, tmp_path, date(2026, 9, 22))
    first, second = read_ticks(path)
    assert (first["close_paise"], first["last_trade_ts"]) == (99, DAY1 - timedelta(seconds=2))
    assert first["bid_price_paise"] == [100, 99, 98, 97, 96]
    assert first["bid_orders"] == [1, 2, 3, 4, 5]
    assert second["bid_price_paise"] is None and second["close_paise"] is None


def test_streams_in_batches_in_time_order(
    db: Session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(archive, "BATCH_ROWS", 2)
    db.add_all([tick("INFY", DAY1 + timedelta(seconds=s), 100 + s) for s in (3, 0, 4, 1, 2)])
    db.commit()
    (path,) = archive_ticks(db, tmp_path, date(2026, 9, 22))
    assert [r["last_price_paise"] for r in read_ticks(path)] == [100, 101, 102, 103, 104]
    assert pq.ParquetFile(path).num_row_groups == 3
    assert count(db) == 0


def test_failure_on_second_symbol_keeps_rows(
    db: Session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    class FailOnTcs(pq.ParquetWriter):  # type: ignore[misc]
        def write_table(self, table: pa.Table, row_group_size: int | None = None) -> None:
            if "TCS" in table.column("symbol").to_pylist():
                raise OSError("disk full")
            super().write_table(table, row_group_size)

    seed(db)
    monkeypatch.setattr(pq, "ParquetWriter", FailOnTcs)
    with pytest.raises(OSError, match="disk full"):
        archive_ticks(db, tmp_path, date(2026, 9, 22))
    db.rollback()
    assert count(db) == 4
    tcs = tick_path(tmp_path, date(2026, 9, 21), "TCS")
    assert not tcs.exists() and not tcs.with_suffix(".parquet.partial").exists()
