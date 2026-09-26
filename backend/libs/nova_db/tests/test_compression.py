"""Compressed candle chunks still read, overwrite and delete like plain ones (NOVA-099, D58)."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from nova_db.models import Candle
from sqlalchemy import Engine, delete, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

OLD = datetime(2025, 3, 3, 3, 45, tzinfo=UTC)  # 09:15 IST, far older than 30 days
PRICES = ("open_paise", "high_paise", "low_paise", "close_paise", "volume")


def _row(symbol: str, minute: int, close: int) -> dict[str, object]:
    return {
        "exchange": "NSE",
        "symbol": symbol,
        "timeframe": "1m",
        "ts": OLD + timedelta(minutes=minute),
        "open_paise": close,
        "high_paise": close + 10,
        "low_paise": close - 10,
        "close_paise": close,
        "volume": 100 + minute,
    }


def _upsert(db: Session, rows: list[dict[str, object]]) -> None:
    """The statement Atlas' `upsert_candles` sends (overwrite mode)."""
    statement = insert(Candle).values(rows)
    statement = statement.on_conflict_do_update(
        index_elements=["exchange", "symbol", "timeframe", "ts"],
        set_={name: statement.excluded[name] for name in PRICES},
    )
    db.execute(statement)


def _read(db: Session, symbol: str) -> list[tuple[datetime, int, int]]:
    rows = db.execute(
        select(Candle.ts, Candle.close_paise, Candle.volume)
        .where(Candle.exchange == "NSE", Candle.symbol == symbol, Candle.timeframe == "1m")
        .order_by(Candle.ts)
    )
    return [tuple(r) for r in rows]


def _compressed_chunks(db: Session) -> int:
    return int(
        db.execute(
            text(
                "SELECT count(*) FROM timescaledb_information.chunks"
                " WHERE hypertable_name = 'candles' AND is_compressed"
            )
        ).scalar_one()
    )


@pytest.fixture
def compressed(engine: Engine) -> Iterator[Session]:
    with Session(engine) as db:
        db.execute(text("TRUNCATE candles"))
        _upsert(db, [_row(s, m, 10_000 + m) for s in ("INFY", "TCS") for m in range(60)])
        db.commit()
        db.execute(
            text(
                "SELECT compress_chunk(c, if_not_compressed => true)"
                " FROM show_chunks('candles', older_than => INTERVAL '30 days') c"
            )
        )
        db.commit()
        assert _compressed_chunks(db) >= 1
        yield db
        db.rollback()
        db.execute(text("TRUNCATE candles"))
        db.commit()


def test_reads_are_unchanged_after_compression(compressed: Session) -> None:
    rows = _read(compressed, "INFY")

    assert len(rows) == 60
    assert rows[0] == (OLD, 10_000, 100) and rows[-1][1:] == (10_059, 159)


def test_overwrite_updates_a_compressed_row(compressed: Session) -> None:
    _upsert(compressed, [_row("INFY", 5, 20_000), _row("INFY", 90, 30_000)])
    compressed.commit()

    rows = dict((ts, close) for ts, close, _ in _read(compressed, "INFY"))
    assert rows[OLD + timedelta(minutes=5)] == 20_000
    assert rows[OLD + timedelta(minutes=90)] == 30_000 and len(rows) == 61


def test_deleting_one_stock_keeps_the_other(compressed: Session) -> None:
    compressed.execute(
        delete(Candle).where(
            Candle.exchange == "NSE",
            Candle.symbol.in_(["INFY"]),
            Candle.timeframe == "1m",
            Candle.ts >= OLD,
            Candle.ts < OLD + timedelta(days=1),
        )
    )
    compressed.commit()

    assert _read(compressed, "INFY") == [] and len(_read(compressed, "TCS")) == 60


def test_the_compression_policy_exists(engine: Engine) -> None:
    with engine.connect() as connection:
        policies = connection.execute(
            text(
                "SELECT schedule_interval, config->>'compress_after'"
                " FROM timescaledb_information.jobs"
                " WHERE proc_name = 'policy_compression' AND hypertable_name = 'candles'"
            )
        ).all()

    assert [tuple(p) for p in policies] == [(timedelta(hours=6), "30 days")]
