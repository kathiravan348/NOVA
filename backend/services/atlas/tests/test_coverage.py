"""Stored data endpoints (D63): trading calendar, missing days, statuses, missing ranges."""

from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from fastapi.testclient import TestClient
from nova_atlas.coverage import missing_ranges
from nova_db.models import CandleDay, DataJob, DataJobStep
from nova_testing.parity import Parity
from sqlalchemy import Engine
from sqlalchemy.orm import Session

COVERAGE = "/api/v1/market-data/coverage"
# Ten weekdays, 14-25 Sep 2026.
DAYS = [date(2026, 9, 14) + timedelta(days=n) for n in range(12)]
DAYS = [d for d in DAYS if d.weekday() < 5]
PERIOD = {"timeframe": "1d", "from": "2026-09-14", "to": "2026-09-25"}


def _store(engine: Engine, symbol: str, days: list[date], timeframe: str = "1d") -> None:
    with Session(engine) as db:
        db.add_all(
            CandleDay(exchange="NSE", symbol=symbol, timeframe=timeframe, day=d, bars=1)
            for d in days
        )
        db.commit()


def _asked(engine: Engine, symbol: str, first: date, last: date, timeframe: str = "1d") -> None:
    """A finished download step that asked Kite for the IST days [first, last]."""
    start = datetime.combine(first, time(), UTC) - timedelta(hours=5, minutes=30)
    end = datetime.combine(last, time(), UTC) + timedelta(hours=18, minutes=29)
    job_id = f"job_{symbol}_{timeframe}"
    with Session(engine) as db:
        db.add(
            DataJob(
                id=job_id,
                type="historical_download",
                status="completed",
                exchange="NSE",
                segment="equity_delivery",
                symbols=[symbol],
                timeframe=timeframe,
                date_from=first,
                date_to=last,
                progress_percent=100,
                finished_at=end,
            )
        )
        db.flush()
        db.add(
            DataJobStep(
                job_id=job_id,
                seq=0,
                symbol=symbol,
                start_at=start,
                end_at=end,
                status="done",
                finished_at=end,
            )
        )
        db.commit()


def _rows(client: TestClient, params: dict[str, str]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Any: JSON body and rows by symbol."""
    response = client.get(COVERAGE, params=params)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body, {row["symbol"]: row for row in body["rows"]}


def _market(engine: Engine) -> None:
    """Ten other stocks trade every day, so the calendar comes from stocks."""
    for n in range(10):
        _store(engine, f"S{n}", DAYS)


def test_statuses_from_a_stock_calendar(client: TestClient, clean: Engine, parity: Parity) -> None:
    _market(clean)
    _store(clean, "INFY", [d for d in DAYS if d not in DAYS[3:6]])  # 17-19 Sep missing
    _store(clean, "TCS", DAYS[4:])  # listed on 18 Sep
    _store(clean, "RELIANCE", DAYS)

    body, rows = _rows(client, PERIOD)

    parity.assert_valid(body, "CoverageList")
    assert body["calendar"] == "stocks"
    assert (rows["INFY"]["status"], rows["INFY"]["days"], rows["INFY"]["missingDays"]) == (
        "gaps",
        7,
        3,
    )
    assert (rows["TCS"]["status"], rows["TCS"]["missingDays"]) == ("partial", 0)
    assert rows["TCS"]["firstDay"] == "2026-09-18"
    assert rows["RELIANCE"]["status"] == "complete"
    assert rows["HDFCBANK"] == rows["HDFCBANK"] | {"status": "none", "days": 0, "firstDay": None}
    assert "S0" not in rows  # only the stock list and indices are listed


def test_the_index_calendar_wins_and_indices_are_listed(client: TestClient, clean: Engine) -> None:
    _market(clean)
    _store(clean, "NIFTY 50", DAYS[:-1])  # the index has no bar on 25 Sep
    _store(clean, "INFY", DAYS[:-1])

    body, rows = _rows(client, PERIOD)

    assert body["calendar"] == "index"
    assert rows["INFY"]["status"] == "complete"  # 25 Sep is not a trading day now
    nifty = rows["NIFTY 50"]
    assert (nifty["kind"], nifty["sector"], nifty["indices"]) == ("index", "Index", [])


def test_a_later_listing_kite_had_nothing_before_is_complete(
    client: TestClient, clean: Engine
) -> None:
    _market(clean)
    _store(clean, "TCS", DAYS[4:])  # listed on 18 Sep: asked from 14 Sep, Kite had nothing earlier
    _asked(clean, "TCS", DAYS[0], DAYS[-1])
    _store(clean, "INFY", DAYS[4:])  # only asked from 18 Sep: the start was never downloaded
    _asked(clean, "INFY", DAYS[4], DAYS[-1])
    _store(clean, "WIPRO", DAYS[5:])  # from Mon 21 Sep, asked from Sat 19 Sep: no trading day asked
    _asked(clean, "WIPRO", date(2026, 9, 19), DAYS[-1])
    _store(clean, "HCLTECH", DAYS[4:])  # asked from 14 Sep, but for another timeframe
    _asked(clean, "HCLTECH", DAYS[0], DAYS[-1], timeframe="1m")

    _, rows = _rows(client, PERIOD)
    _, later = _rows(client, PERIOD | {"from": "2026-09-16"})

    assert (rows["TCS"]["status"], rows["TCS"]["missingDays"]) == ("complete", 0)
    assert rows["TCS"]["firstDay"] == "2026-09-18"
    assert rows["INFY"]["status"] == "partial"
    assert rows["WIPRO"]["status"] == "partial"
    assert rows["HCLTECH"]["status"] == "partial"
    assert later["TCS"]["status"] == "complete"


def test_indices_without_candles_are_listed_as_no_data(client: TestClient, clean: Engine) -> None:
    _market(clean)

    _, rows = _rows(client, PERIOD)

    nifty = rows["NIFTY 50"]
    assert (nifty["kind"], nifty["status"], nifty["days"], nifty["firstDay"]) == (
        "index",
        "none",
        0,
        None,
    )


def test_the_period_clips_what_counts(client: TestClient, clean: Engine) -> None:
    _market(clean)
    _store(clean, "INFY", [d for d in DAYS if d != DAYS[1]])  # 15 Sep missing

    _, inside = _rows(client, PERIOD | {"from": "2026-09-16"})
    _, before = _rows(client, PERIOD | {"from": "2026-09-01", "to": "2026-09-13"})

    assert (inside["INFY"]["status"], inside["INFY"]["days"]) == ("complete", 8)
    assert inside["INFY"]["firstDay"] == "2026-09-14"  # the whole stored range stays
    assert before["INFY"]["status"] == "none"
    assert client.get(COVERAGE, params=PERIOD | {"from": "2026-09-30"}).status_code == 400


def test_the_period_starts_on_1_jan_2020_by_default(client: TestClient, clean: Engine) -> None:
    """D69: without `from` the period starts 2020-01-01, or at `to` when that is earlier."""
    _market(clean)

    body, _ = _rows(client, {"timeframe": "1d", "to": "2026-09-25"})
    early, _ = _rows(client, {"timeframe": "1d", "to": "2019-06-30"})

    assert (body["from"], body["to"]) == ("2020-01-01", "2026-09-25")
    assert (early["from"], early["to"]) == ("2019-06-30", "2019-06-30")


def test_detail_merges_missing_days_into_ranges(
    client: TestClient, clean: Engine, parity: Parity
) -> None:
    _market(clean)
    gaps = {DAYS[1], DAYS[4], DAYS[5]}  # 15 Sep; 18 and 21 Sep follow each other in the calendar
    _store(clean, "INFY", [d for d in DAYS if d not in gaps])

    response = client.get(f"{COVERAGE}/INFY", params=PERIOD)

    assert response.status_code == 200
    body = response.json()
    parity.assert_valid(body, "CoverageDetail")
    assert body["missingDays"] == 3
    assert body["missing"] == [
        {"from": "2026-09-15", "to": "2026-09-15", "days": 1},
        {"from": "2026-09-18", "to": "2026-09-21", "days": 2},
    ]
    assert client.get(f"{COVERAGE}/NIFTY%2050", params=PERIOD).status_code == 200
    assert client.get(f"{COVERAGE}/NOPE", params=PERIOD).status_code == 404


def test_missing_ranges_on_their_own() -> None:
    assert missing_ranges(set(DAYS), DAYS, DAYS[0], DAYS[-1]) == []
    ranges = missing_ranges(set(DAYS[2:]), DAYS, DAYS[0], DAYS[-1])
    assert [(r.from_, r.to, r.days) for r in ranges] == [(DAYS[0], DAYS[1], 2)]
