"""Tick archive to Parquet (D49)."""

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
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
