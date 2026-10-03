"""Daily Kite check of recorded ticks and `GET /live/checks` (D81 (4))."""

import threading
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from nova_atlas.broker_client import BrokerData, BrokerDataError
from nova_atlas.live_check import DailyCheck, check_day, next_day, sample
from nova_atlas.worker import run_worker
from nova_db.models import Instrument, Tick, TickCheck, TickDay, TickSession
from sqlalchemy import Engine, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker

CHECKS = "/api/v1/live/checks"
THU = date(2026, 10, 1)
FRI = date(2026, 10, 2)


def ist(day: date, hour: int, minute: int, second: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, second, tzinfo=UTC) - timedelta(
        hours=5, minutes=30
    )


class FakeKite(BrokerData):
    """Serves fixed minute candles per token; `fail` raises like a logged-out Kite."""

    def __init__(self, candles: dict[int, list[list[Any]]], fail: bool = False) -> None:
        self.candles, self.fail, self.calls = candles, fail, 0

    def historical(
        self, instrument_token: int, interval: str, start: datetime, end: datetime
    ) -> list[list[Any]]:
        self.calls += 1
        if self.fail:
            raise BrokerDataError("Kite is not logged in today.")
        return self.candles.get(instrument_token, [])


def candle(day: date, minute: int, high: float, low: float, close: float, vol: int) -> list[Any]:
    at = datetime(day.year, day.month, day.day, 9, minute).isoformat() + "+05:30"
    return [at, close, high, low, close, vol]


def tick(symbol: str, at: datetime, price: int, volume: int, delay: float = 0.4) -> dict[str, Any]:
    return {
        "exchange": "NSE",
        "symbol": symbol,
        "received_at": at + timedelta(seconds=delay),
        "exchange_ts": at,
        "last_price_paise": price,
        "last_qty": 1,
        "volume": volume,
    }


def seed(db: Session, day: date, delay: float = 0.4) -> None:
    """INFY: minutes 09:15–09:18; TCS: has ticks but Kite sends no candles (skipped)."""
    db.add_all(
        [
            Instrument(
                exchange="NSE",
                symbol=s,
                name=s,
                sector="IT",
                segment="equity_delivery",
                indices=[],
                instrument_token=t,
            )
            for s, t in (("INFY", 1), ("TCS", 2))
        ]
    )
    db.add(
        TickSession(day=day, stocks=2, ticks=900, feed_gap_seconds=0, summarized_at=ist(day, 16, 0))
    )
    for symbol in ("INFY", "TCS"):
        db.add(
            TickDay(
                exchange="NSE", symbol=symbol, day=day, ticks=450, size_bytes=1, seconds_with_tick=1
            )
        )
    rows = [
        tick("INFY", ist(day, 9, 15, 10), 10_000, 100, delay),
        tick("INFY", ist(day, 9, 16, 5), 10_010, 150, delay),
        tick("INFY", ist(day, 9, 16, 50), 10_020, 160, delay),  # 09:16: close 100.20, vol 60
        tick("INFY", ist(day, 9, 17, 30), 10_050, 200, delay),  # 09:17: close wrong, vol 40
        tick("INFY", ist(day, 9, 18, 30), 10_090, 260, delay),  # 09:18: high above Kite's
        tick("TCS", ist(day, 9, 16, 0), 30_000, 10, delay),
    ]
    db.execute(insert(Tick), rows)
    db.commit()


KITE = {
    1: [
        candle(THU, 15, 100.10, 99.90, 100.00, 100),  # 09:15 is never compared
        candle(THU, 16, 100.30, 100.00, 100.20, 60),  # all three match
        candle(THU, 17, 100.60, 100.40, 100.55, 40),  # close differs; volume matches
        candle(THU, 18, 100.80, 100.70, 100.90, 99),  # high above Kite's; volume differs
    ]
}


def test_minutes_compare_close_range_and_volume(clean: Engine) -> None:
    with Session(clean) as db:
        seed(db, THU)
        row = check_day(db, FakeKite(KITE), THU, ist(THU, 16, 5))
    assert (row.stocks_checked, row.stocks_skipped) == (1, 1)
    assert (row.minutes, row.close_matches, row.range_ok) == (3, 2, 2)
    assert (row.volume_minutes, row.volume_matches) == (3, 2)
    assert row.clock_offset_ms == 400
    assert row.stocks[0] == {
        "symbol": "INFY",
        "minutes": 3,
        "closeMatches": 2,
        "rangeOk": 2,
        "volumeMinutes": 3,
        "volumeMatches": 2,
    }


def test_sample_takes_busiest_then_random_and_skips_inavs(clean: Engine) -> None:
    with Session(clean) as db:
        db.add_all(
            TickDay(
                exchange="NSE",
                symbol=f"S{i:02}",
                day=THU,
                ticks=1000 + i,
                size_bytes=1,
                seconds_with_tick=1,
            )
            for i in range(60)
        )
        db.add(
            TickDay(
                exchange="NSE",
                symbol="ABCINAV",
                day=THU,
                ticks=99_999,
                size_bytes=1,
                seconds_with_tick=1,
            )
        )
        db.add(
            TickDay(
                exchange="NSE",
                symbol="QUIET",
                day=THU,
                ticks=199,
                size_bytes=1,
                seconds_with_tick=1,
            )
        )
        db.commit()
        picked = sample(db, THU)
        assert picked[:10] == [f"S{i:02}" for i in range(59, 49, -1)]
        assert len(picked) == 50 and "ABCINAV" not in picked and "QUIET" not in picked
        assert sample(db, THU) == picked


def test_api_returns_percents_and_a_clock_warning(clean: Engine, client: TestClient) -> None:
    with Session(clean) as db:
        seed(db, THU, delay=16.0)
        check_day(db, FakeKite(KITE), THU, ist(THU, 16, 5))
    response = client.get(CHECKS)
    assert response.status_code == 200
    [found] = response.json()
    assert found["closeMatchPercent"] == 66.7 and found["volumeMatchPercent"] == 66.7
    assert found["clockOffsetSeconds"] == 16.0
    assert "Receive times are 16 s off exchange times: sync the PC clock" in found["warnings"]
    assert any("Minute closes matched" in w for w in found["warnings"])
    assert client.get(CHECKS, params={"limit": 0}).status_code == 400


def test_next_day_waits_for_1600_ist_and_never_rechecks(clean: Engine) -> None:
    with Session(clean) as db:
        seed(db, FRI)
        assert next_day(db, ist(FRI, 15, 59)) is None
        assert next_day(db, ist(FRI, 16, 0)) == FRI
        check_day(db, FakeKite(KITE), FRI, ist(FRI, 16, 0))
        assert next_day(db, ist(FRI, 16, 1)) is None
        assert next_day(db, ist(FRI + timedelta(days=11), 10, 0)) is None


def test_a_broker_error_stores_nothing_and_waits_15_minutes(clean: Engine) -> None:
    kite = FakeKite(KITE, fail=True)
    daily = DailyCheck(kite)
    with Session(clean) as db:
        seed(db, THU)
        now = ist(FRI, 10, 0)
        assert daily.check_next(db, now) is None
        assert db.scalar(select(func.count()).select_from(TickCheck)) == 0
        calls = kite.calls
        assert daily.check_next(db, now + timedelta(minutes=14)) is None
        assert kite.calls == calls
        kite.fail = False
        assert daily.check_next(db, now + timedelta(minutes=15)) == THU


@pytest.mark.parametrize("limit", [61, -1])
def test_limit_bounds(client: TestClient, limit: int) -> None:
    assert client.get(CHECKS, params={"limit": limit}).status_code == 400


def test_the_worker_runs_the_check_after_the_summary_and_survives_errors(
    factory: sessionmaker[Session], broker: BrokerData
) -> None:
    stop = threading.Event()
    order: list[str] = []

    def summarize(_: Session) -> None:
        order.append("summary")

    def boom(_: Session) -> None:
        order.append("check")
        raise RuntimeError("Kite is slow")

    run_worker(factory, broker, stop, 0, on_idle=stop.set, summarize=summarize, check=boom)
    assert order == ["summary", "check"]
