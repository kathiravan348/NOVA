"""Roll-ups from 1m bars start at 09:15 IST like Kite's candles (NOVA-100, D58)."""

from collections.abc import Iterator
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from nova_db.candles import BarRow, read_bars
from nova_db.models import Candle
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

IST = ZoneInfo("Asia/Kolkata")
DAY = date(2026, 9, 1)
OPEN = datetime.combine(DAY, time(9, 15), tzinfo=IST)


def _minute(at: datetime, close: int, volume: int = 10) -> Candle:
    return Candle(
        exchange="NSE",
        symbol="INFY",
        timeframe="1m",
        ts=at.astimezone(UTC),
        open_paise=close - 5,
        high_paise=close + 20,
        low_paise=close - 20,
        close_paise=close,
        volume=volume,
    )


def _day_span() -> tuple[datetime, datetime]:
    start = datetime.combine(DAY, time(0), tzinfo=IST)
    return start, start + timedelta(days=1)


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    with Session(engine) as session:
        session.execute(text("TRUNCATE candles"))
        session.commit()
        yield session
        session.rollback()
        session.execute(text("TRUNCATE candles"))
        session.commit()


def test_fifteen_minutes_become_three_5m_bars(db: Session) -> None:
    db.add_all(_minute(OPEN + timedelta(minutes=m), 1_000 + m, volume=m + 1) for m in range(15))
    db.commit()

    bars = read_bars(db, "NSE", "INFY", "5m", *_day_span())

    assert [b.ts.astimezone(IST).time() for b in bars] == [time(9, 15), time(9, 20), time(9, 25)]
    assert bars[0] == BarRow(OPEN.astimezone(UTC), 995, 1_024, 980, 1_004, sum(range(1, 6)))
    assert (bars[2].open_paise, bars[2].close_paise, bars[2].volume) == (1_005, 1_014, 65)


def test_hour_buckets_start_at_915_and_the_last_one_is_short(db: Session) -> None:
    closing = datetime.combine(DAY, time(15, 29), tzinfo=IST)
    minutes = int((closing - OPEN).total_seconds() // 60) + 1
    db.add_all(_minute(OPEN + timedelta(minutes=m), 2_000) for m in range(minutes))
    db.commit()

    bars = read_bars(db, "NSE", "INFY", "1h", *_day_span())

    assert [b.ts.astimezone(IST).time() for b in bars] == [time(h, 15) for h in range(9, 16)]
    assert bars[-1].volume == 15 * 10  # 15:15–15:29
    assert bars[0].volume == 60 * 10


def test_missing_minutes_still_roll_up(db: Session) -> None:
    for m in (0, 1, 3, 7, 9):
        db.add(_minute(OPEN + timedelta(minutes=m), 3_000 + m))
    db.commit()

    bars = read_bars(db, "NSE", "INFY", "5m", *_day_span())

    assert [(b.open_paise, b.close_paise, b.volume) for b in bars] == [
        (2_995, 3_003, 30),
        (3_002, 3_009, 20),
    ]


def test_1d_returns_the_stored_rows_and_stored_5m_rows_are_ignored(db: Session) -> None:
    daily = datetime.combine(DAY, time(0), tzinfo=IST)
    db.add(
        Candle(
            exchange="NSE",
            symbol="INFY",
            timeframe="1d",
            ts=daily,
            open_paise=100,
            high_paise=120,
            low_paise=90,
            close_paise=110,
            volume=5,
        )
    )
    db.add(_minute(OPEN, 4_000))
    db.add(
        Candle(
            exchange="NSE",
            symbol="INFY",
            timeframe="5m",
            ts=OPEN,
            open_paise=1,
            high_paise=1,
            low_paise=1,
            close_paise=1,
            volume=1,
        )
    )
    db.commit()

    (day,) = read_bars(db, "NSE", "INFY", "1d", *_day_span())
    (five,) = read_bars(db, "NSE", "INFY", "5m", *_day_span())

    assert day == BarRow(daily.astimezone(UTC), 100, 120, 90, 110, 5)
    assert five.close_paise == 4_000
