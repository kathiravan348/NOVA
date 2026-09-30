"""Successful response evidence, history, recovery, calendar and planning (D70)."""

from datetime import UTC, date, datetime

import httpx2
from fastapi.testclient import TestClient
from nova_atlas.broker_client import BrokerData
from nova_atlas.candle_days import calendar
from nova_atlas.download import Pacer, run_download, to_row, upsert_candles
from nova_atlas.jobs import queue_download
from nova_atlas.plan import build_plan, create_download
from nova_atlas.unavailable import record_check
from nova_atlas.universe import sync_instruments
from nova_db.models import CandleDay, DataJob, UnavailableDay
from nova_testing.parity import Parity
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

FIRST, MIDDLE, LAST = (date(2026, 9, n) for n in (21, 22, 23))


def _bar(day: date) -> list[str | int]:
    return [f"{day}T00:00:00+0530", 100, 110, 90, 105, 10]


def _seed(engine: Engine, broker: BrokerData, days: list[date]) -> None:
    with Session(engine) as db:
        sync_instruments(db, broker, today=LAST)
        db.add_all(
            CandleDay(exchange="NSE", symbol="NIFTY 50", timeframe="1d", day=d, bars=1)
            for d in days
        )
        rows = [to_row("NSE", "INFY", "1d", _bar(d)) for d in (FIRST, LAST)]
        upsert_candles(db, [row for row in rows if row is not None])
        db.add_all(
            CandleDay(exchange="NSE", symbol="INFY", timeframe="1d", day=d, bars=1)
            for d in (FIRST, LAST)
        )
        db.commit()


def _check(db: Session, key: str = "check_1", job_id: str | None = None) -> int:
    return record_check(
        db,
        exchange="NSE",
        symbol="INFY",
        timeframe="1d",
        first=FIRST,
        last=LAST,
        check_id=key,
        job_id=job_id,
    )


def test_evidence_is_idempotent_then_recovers(clean: Engine, broker: BrokerData) -> None:
    _seed(clean, broker, [FIRST, MIDDLE, LAST])
    with Session(clean) as db:
        assert _check(db) == 1
        db.commit()
        assert _check(db) == 1
        db.commit()
        row = db.scalars(select(UnavailableDay)).one()
        assert row.attempts == 1 and row.day == MIDDLE
        assert _check(db, "check_2") == 1
        db.commit()
        db.refresh(row)
        assert row.attempts == 2 and row.resolved_at is None
        db.add(CandleDay(exchange="NSE", symbol="INFY", timeframe="1d", day=MIDDLE, bars=1))
        db.flush()
        assert _check(db, "check_3") == 0
        db.commit()
        db.refresh(row)
        assert row.attempts == 3 and row.resolved_at is not None
        db.delete(
            db.scalars(
                select(CandleDay).where(CandleDay.symbol == "INFY", CandleDay.day == MIDDLE)
            ).one()
        )
        db.flush()
        assert _check(db, "check_4") == 1
        db.commit()
        db.refresh(row)
        assert row.resolved_at is None and row.attempts == 4


def test_history_survives_job_deletion_and_pages(
    clean: Engine, broker: BrokerData, client: TestClient, parity: Parity
) -> None:
    _seed(clean, broker, [FIRST, MIDDLE, LAST])
    with Session(clean) as db:
        job = queue_download(
            db, symbols=["INFY"], timeframe="1d", first=FIRST, last=LAST, segment="equity_delivery"
        )
        db.flush()
        _check(db, job_id=job.id)
        db.commit()
        db.delete(job)
        db.commit()
        assert db.scalars(select(UnavailableDay)).one().last_job_id is None
        record_check(
            db,
            exchange="NSE",
            symbol="INFY",
            timeframe="1m",
            first=FIRST,
            last=LAST,
            check_id="minute",
        )  # no minute bounds; no false records
        db.commit()
    params = {"timeframe": "1d", "from": str(FIRST), "to": str(LAST)}
    response = client.get("/api/v1/market-data/unavailable", params=params)
    assert response.status_code == 200
    body = response.json()
    assert body["nextCursor"] is None and len(body["items"]) == 1
    parity.assert_valid(body["items"][0], "UnavailableDay")
    assert body["items"][0]["lastJobId"] is None
    assert (
        client.get(
            "/api/v1/market-data/unavailable", params=params | {"status": "resolved"}
        ).json()["items"]
        == []
    )
    assert (
        client.get("/api/v1/market-data/unavailable", params=params | {"symbol": "NOPE"}).json()[
            "items"
        ]
        == []
    )
    assert (
        client.get("/api/v1/market-data/unavailable", params=params | {"cursor": "bad"}).status_code
        == 400
    )
    assert (
        client.get(
            "/api/v1/market-data/unavailable", params=params | {"from": "2027-01-01"}
        ).status_code
        == 400
    )


def test_routine_plan_skips_explained_dates_but_overwrite_rechecks(
    clean: Engine, broker: BrokerData, client: TestClient
) -> None:
    _seed(clean, broker, [FIRST, MIDDLE, LAST])
    with Session(clean) as db:
        _check(db)
        db.commit()
        for mode, expected in [("skip_existing", 0), ("overwrite", 1)]:
            plan, _ = build_plan(
                db,
                symbols=["INFY"],
                timeframe="1d",
                first=FIRST,
                last=LAST,
                mode=mode,
                now=datetime(2026, 9, 28, tzinfo=UTC),
            )
            assert plan.requests == expected
    rows = client.get(
        "/api/v1/market-data/coverage", params={"from": str(FIRST), "to": str(LAST)}
    ).json()["rows"]
    row = next(r for r in rows if r["symbol"] == "INFY")
    assert (row["status"], row["missingDays"], row["unavailableDays"]) == ("unavailable", 1, 1)
    # An unfilled end of the requested history still needs a routine download.
    with Session(clean) as db:
        db.add(
            CandleDay(
                exchange="NSE", symbol="NIFTY 50", timeframe="1d", day=date(2026, 9, 24), bars=1
            )
        )
        db.commit()
    rows = client.get(
        "/api/v1/market-data/coverage", params={"from": str(FIRST), "to": "2026-09-24"}
    ).json()["rows"]
    assert next(r for r in rows if r["symbol"] == "INFY")["status"] == "gaps"


def test_broker_errors_are_not_unavailable_evidence(clean: Engine, broker: BrokerData) -> None:
    _seed(clean, broker, [FIRST, MIDDLE, LAST])
    with Session(clean) as db:
        job = queue_download(
            db, symbols=["INFY"], timeframe="1d", first=FIRST, last=LAST, segment="equity_delivery"
        )
        db.commit()
        job_id = job.id
    client = BrokerData(
        "http://broker",
        "test",
        transport=httpx2.MockTransport(
            lambda request: httpx2.Response(503, json={"error": {"message": "Unavailable"}})
        ),
    )
    try:
        with Session(clean) as db:
            run_download(db, job_id, client, Pacer(sleep=lambda _: None))
            assert db.scalar(select(func.count()).select_from(UnavailableDay)) == 0
            assert db.get(DataJob, job_id).status == "failed"  # type: ignore[union-attr]
    finally:
        client.close()


def test_endpoint_keyset_pages_do_not_repeat_dates(
    clean: Engine, broker: BrokerData, client: TestClient
) -> None:
    _seed(clean, broker, [FIRST, MIDDLE, LAST])
    with Session(clean) as db:
        _check(db)
        db.add_all(
            CandleDay(exchange="NSE", symbol="TCS", timeframe="1d", day=d, bars=1)
            for d in (FIRST, LAST)
        )
        db.flush()
        record_check(
            db, exchange="NSE", symbol="TCS", timeframe="1d", first=FIRST, last=LAST, check_id="tcs"
        )
        db.commit()
    path = "/api/v1/market-data/unavailable"
    params = {"from": str(FIRST), "to": str(LAST), "limit": "1"}
    first = client.get(path, params=params).json()
    second = client.get(path, params=params | {"cursor": first["nextCursor"]}).json()
    assert first["nextCursor"] and second["nextCursor"] is None
    assert first["items"][0]["id"] != second["items"][0]["id"]
    offset = client.get(path, params=params | {"offset": "1"}).json()
    assert offset == second
    assert first["total"] == second["total"] == 2
    assert (
        client.get(path, params=params | {"offset": "0", "cursor": first["nextCursor"]}).status_code
        == 422
    )


def test_calendar_unions_stock_sessions_with_index_and_observes_sunday(clean: Engine) -> None:
    special = date(2026, 11, 8)  # synthetic Sunday session evidence; not an external holiday lookup
    closed = date(2026, 11, 9)
    with Session(clean) as db:
        db.add(CandleDay(exchange="NSE", symbol="NIFTY 50", timeframe="1d", day=special, bars=1))
        db.add_all(
            CandleDay(exchange="NSE", symbol=f"S{n}", timeframe="1d", day=FIRST, bars=1)
            for n in range(10)
        )
        db.add_all(
            CandleDay(exchange="NSE", symbol="INFY", timeframe="1d", day=d, bars=1)
            for d in [FIRST, special]
        )
        db.commit()
        assert calendar(db, FIRST, closed) == ([FIRST, special], "index")
        assert (
            record_check(
                db,
                exchange="NSE",
                symbol="INFY",
                timeframe="1d",
                first=FIRST,
                last=closed,
                check_id="holiday",
            )
            == 0
        )


def test_download_records_empty_check_and_resolves_on_valid_candle(
    clean: Engine, broker: BrokerData
) -> None:
    _seed(clean, broker, [FIRST, MIDDLE, LAST])
    for bars, state in [([], "unavailable"), ([_bar(MIDDLE)], "resolved")]:

        def response(
            request: httpx2.Request, candles: list[list[str | int]] = bars
        ) -> httpx2.Response:
            return httpx2.Response(200, json={"candles": candles})

        client = BrokerData("http://broker", "test", transport=httpx2.MockTransport(response))
        try:
            with Session(clean) as db:
                job = create_download(
                    db,
                    symbols=["INFY"],
                    timeframe="1d",
                    first=MIDDLE,
                    last=MIDDLE,
                    segment="equity_delivery",
                    mode="overwrite",
                    start=True,
                    actor_id=None,
                    actor_name="Console",
                    ip=None,
                )
                db.commit()
                run_download(db, job.id, client, Pacer(sleep=lambda _: None))
                row = db.scalars(select(UnavailableDay)).one()
                assert (row.resolved_at is None) == (state == "unavailable")
                assert row.attempts == (1 if state == "unavailable" else 2)
        finally:
            client.close()


def test_routine_download_completes_on_known_gaps_but_overwrite_fails(
    clean: Engine, broker: BrokerData
) -> None:
    new_day = date(2026, 9, 24)
    _seed(clean, broker, [FIRST, MIDDLE, LAST, new_day])
    with Session(clean) as db:
        record_check(
            db, exchange="NSE", symbol="INFY", timeframe="1d", first=FIRST, last=LAST,
            check_id="earlier", at=datetime(2026, 9, 27, tzinfo=UTC),
        )  # fmt: skip
        db.commit()

    def response(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={"candles": [_bar(d) for d in (FIRST, LAST, new_day)]})

    client = BrokerData("http://broker", "test", transport=httpx2.MockTransport(response))
    try:
        for mode, status in [("skip_existing", "completed"), ("overwrite", "failed")]:
            with Session(clean) as db:
                job = create_download(
                    db, symbols=["INFY"], timeframe="1d", first=FIRST, last=new_day,
                    segment="equity_delivery", mode=mode, start=True, actor_id=None,
                    actor_name="Console", ip=None,
                )  # fmt: skip
                db.commit()
                run_download(db, job.id, client, Pacer(sleep=lambda _: None))
                db.refresh(job)
                assert job.status == status
                if status == "completed":
                    assert job.error is None and job.summary is not None
                    assert "Known broker-unavailable days remain (INFY: 1)" in job.summary
                else:
                    assert job.error is not None and "INFY: 1" in job.error
    finally:
        client.close()
