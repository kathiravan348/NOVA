"""Stored data endpoints (D63): trading calendar, missing days, statuses, missing ranges."""

from datetime import date, timedelta
from typing import Any

from fastapi.testclient import TestClient
from nova_atlas.coverage import missing_ranges
from nova_db.models import CandleDay
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


def test_the_period_clips_what_counts(client: TestClient, clean: Engine) -> None:
    _market(clean)
    _store(clean, "INFY", [d for d in DAYS if d != DAYS[1]])  # 15 Sep missing

    _, inside = _rows(client, PERIOD | {"from": "2026-09-16"})
    _, before = _rows(client, PERIOD | {"from": "2026-09-01", "to": "2026-09-13"})

    assert (inside["INFY"]["status"], inside["INFY"]["days"]) == ("complete", 8)
    assert inside["INFY"]["firstDay"] == "2026-09-14"  # the whole stored range stays
    assert before["INFY"]["status"] == "none"
    assert client.get(COVERAGE, params=PERIOD | {"from": "2026-09-30"}).status_code == 400


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
