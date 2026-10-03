"""Daily tick summaries and `GET /live/stocks` (D80)."""

import threading
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from nova_atlas.archive import archive_ticks
from nova_atlas.broker_client import BrokerData
from nova_atlas.live_summary import pending_days, summarize_day, summarize_next
from nova_atlas.worker import run_worker
from nova_db.models import Tick, TickDay, TickSession
from nova_testing.parity import Parity
from sqlalchemy import Engine, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker

STOCKS = "/api/v1/live/stocks"
MON, TUE, WED = date(2026, 9, 28), date(2026, 9, 29), date(2026, 9, 30)
SESSION = 22_500


def open_at(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, 3, 45, tzinfo=UTC)  # 09:15 IST


def ist(day: date, hour: int, minute: int) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=UTC) - timedelta(
        hours=5, minutes=30
    )


def rows(symbol: str, day: date, seconds: range) -> list[dict[str, object]]:
    start = open_at(day)
    return [
        {
            "exchange": "NSE",
            "symbol": symbol,
            "received_at": start + timedelta(seconds=s),
            "last_price_paise": 100,
            "last_qty": 1,
            "volume": s,
        }
        for s in seconds
    ]


def seed(db: Session) -> None:
    """MON: full feed, INFY 3 ticks. TUE: full feed, no INFY. WED: a few ticks only (feed gap)."""
    batch = (
        rows("TCS", MON, range(SESSION))
        + rows("INFY", MON, range(3))
        + rows("TCS", TUE, range(SESSION))
        + rows("TCS", WED, range(10))
        + rows("INFY", WED, range(5, 7))
    )
    db.execute(insert(Tick), batch)
    db.commit()


def summarize_all(db: Session, root: Path, now: datetime) -> list[date]:
    done = []
    while (day := summarize_next(db, root, now)) is not None:
        done.append(day)
    return done


def test_summaries_and_gap_days(
    client: TestClient, clean: Engine, tmp_path: Path, parity: Parity
) -> None:
    with Session(clean) as db:
        seed(db)
        assert pending_days(db, tmp_path, ist(WED, 15, 0)) == [MON, TUE]  # today waits for 15:35
        assert summarize_all(db, tmp_path, ist(WED, 15, 40)) == [MON, TUE, WED]
        assert summarize_next(db, tmp_path, ist(WED, 15, 41)) is None  # nothing left
        sessions = {s.day: s for s in db.scalars(select(TickSession))}
        assert {d: (s.stocks, s.feed_gap_seconds) for d, s in sessions.items()} == {
            MON: (2, 0),
            TUE: (1, 0),
            WED: (2, SESSION - 10),
        }
        infy = db.get(TickDay, ("NSE", "INFY", MON))
        assert infy is not None and (infy.ticks, infy.seconds_with_tick) == (3, 3)
        assert infy.size_bytes > 0

    body = client.get(STOCKS, params={"symbols": "INFY,TCS,RELIANCE"}).json()
    for row in body:
        parity.assert_valid(row, "LiveStockHistory")
    by = {row["symbol"]: row for row in body}
    # INFY: stored MON + WED; TUE not tracked and WED had a feed gap → 2 gap days.
    assert by["INFY"] | {"sizeBytes": 0} == {
        "symbol": "INFY",
        "daysStored": 2,
        "firstDay": "2026-09-28",
        "lastDay": "2026-09-30",
        "gapDays": 2,
        "tickCount": 5,
        "sizeBytes": 0,
    }
    assert (by["TCS"]["daysStored"], by["TCS"]["gapDays"]) == (3, 1)
    assert by["RELIANCE"] == {
        "symbol": "RELIANCE",
        "daysStored": 0,
        "firstDay": None,
        "lastDay": None,
        "gapDays": 0,
        "tickCount": 0,
        "sizeBytes": 0,
    }


def test_archived_day_is_summarized_from_parquet(clean: Engine, tmp_path: Path) -> None:
    with Session(clean) as db:
        seed(db)
        archive_ticks(db, tmp_path, TUE)  # MON leaves the database
        summary = summarize_day(db, tmp_path, MON, ist(WED, 16, 0))
        assert (summary.stocks, summary.ticks, summary.feed_gap_seconds) == (2, SESSION + 3, 0)
        infy = db.get(TickDay, ("NSE", "INFY", MON))
        assert infy is not None and (infy.ticks, infy.seconds_with_tick) == (3, 3)


def test_weekends_and_future_days_are_never_pending(clean: Engine, tmp_path: Path) -> None:
    with Session(clean) as db:
        db.execute(insert(Tick), rows("TCS", date(2026, 9, 27), range(2)))  # Sunday
        db.commit()
        assert pending_days(db, tmp_path, ist(WED, 16, 0)) == []


def test_bad_selection_and_unknown_stock(client: TestClient) -> None:
    assert client.get(STOCKS, params={"symbols": ""}).status_code in (400, 422)
    too_many = ",".join(f"S{i}" for i in range(501))
    assert client.get(STOCKS, params={"symbols": too_many}).status_code in (400, 422)
    assert client.get(STOCKS, params={"symbols": "UNKNOWN"}).status_code == 404


def test_a_failing_summary_never_stops_the_worker(
    factory: sessionmaker[Session], broker: BrokerData
) -> None:
    stop = threading.Event()
    calls: list[int] = []

    def boom(_: Session) -> None:
        calls.append(1)
        raise RuntimeError("disk full")

    run_worker(factory, broker, stop, 0, on_idle=stop.set, summarize=boom)
    assert calls == [1]


def test_longest_feed_gap_counts_each_gap_and_both_session_boundaries(
    clean: Engine, tmp_path: Path
) -> None:
    with Session(clean) as db:
        # A second stock fills everything except a 12-second gap and a 45-second gap.
        from sqlalchemy import delete

        db.execute(delete(Tick))
        db.execute(insert(Tick), rows("INFY", MON, range(0, 100)))
        db.execute(insert(Tick), rows("TCS", MON, range(112, 1000)))
        db.execute(insert(Tick), rows("INFY", MON, range(1045, SESSION)))
        summary = summarize_day(db, tmp_path, MON, ist(WED, 16, 0))
        assert summary.feed_gap_seconds == 57 and summary.longest_feed_gap_seconds == 45
        db.execute(delete(Tick))
        db.execute(insert(Tick), rows("INFY", MON, range(50, SESSION - 20)))
        db.commit()
        assert summarize_day(db, tmp_path, MON, ist(WED, 16, 0)).longest_feed_gap_seconds == 50
        db.execute(delete(Tick))
        db.execute(insert(Tick), rows("INFY", MON, range(0, SESSION - 60)))
        db.commit()
        assert summarize_day(db, tmp_path, MON, ist(WED, 16, 0)).longest_feed_gap_seconds == 60


def test_an_old_null_summary_is_rebuilt_once(clean: Engine, tmp_path: Path) -> None:
    with Session(clean) as db:
        db.execute(insert(Tick), rows("INFY", MON, range(SESSION)))
        db.add(
            TickSession(
                day=MON,
                stocks=1,
                ticks=SESSION,
                feed_gap_seconds=0,
                longest_feed_gap_seconds=None,
                summarized_at=ist(WED, 16, 0),
            )
        )
        db.commit()
        assert summarize_next(db, tmp_path, ist(WED, 16, 0)) == MON
        summary = db.get(TickSession, MON)
        assert summary is not None and summary.longest_feed_gap_seconds == 0
        assert summarize_next(db, tmp_path, ist(WED, 16, 1)) is None


def test_empty_recording_has_zero_longest_gap(clean: Engine, tmp_path: Path) -> None:
    with Session(clean) as db:
        summary = summarize_day(db, tmp_path, MON, ist(WED, 16, 0))
        assert summary.feed_gap_seconds == summary.longest_feed_gap_seconds == 0
