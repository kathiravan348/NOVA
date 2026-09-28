"""Downloads must retry small gaps and report unfilled broker-history holes honestly."""

from datetime import UTC, date, datetime

import httpx2
import pytest
from nova_atlas.broker_client import BrokerData
from nova_atlas.download import Pacer, run_download, to_row, upsert_candles
from nova_atlas.jobs import queue_download
from nova_atlas.plan import build_plan
from nova_atlas.universe import sync_instruments
from nova_db.models import Candle, CandleDay, DataJob
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

FIRST, MIDDLE, LAST = (date(2026, 9, n) for n in (21, 22, 23))


def _bar(day: date) -> list[str | int]:
    return [f"{day}T00:00:00+0530", 100, 110, 90, 105, 10]


def _seed(engine: Engine, broker: BrokerData, calendar_days: list[date]) -> None:
    with Session(engine) as db:
        sync_instruments(db, broker, today=LAST)
        db.add_all(
            CandleDay(exchange="NSE", symbol="NIFTY 50", timeframe="1d", day=day, bars=1)
            for day in calendar_days
        )
        rows = [to_row("NSE", "INFY", "1d", _bar(day)) for day in (FIRST, LAST)]
        upsert_candles(db, [row for row in rows if row is not None])
        db.add_all(
            CandleDay(exchange="NSE", symbol="INFY", timeframe="1d", day=day, bars=1)
            for day in (FIRST, LAST)
        )
        db.commit()


@pytest.mark.parametrize("trading_middle", [True, False])
def test_plan_retries_one_day_gap_but_not_an_exchange_holiday(
    clean: Engine, broker: BrokerData, trading_middle: bool
) -> None:
    _seed(clean, broker, [FIRST, MIDDLE, LAST] if trading_middle else [FIRST, LAST])
    with Session(clean) as db:
        plan, _steps = build_plan(
            db, symbols=["INFY"], timeframe="1d", first=FIRST, last=LAST,
            mode="skip_existing", now=datetime(2026, 9, 28, tzinfo=UTC),
        )  # fmt: skip
    assert plan.requests == int(trading_middle)
    assert plan.skipped_steps == int(not trading_middle)


@pytest.mark.parametrize("targeted", [False, True])
def test_empty_or_incomplete_broker_response_fails_and_keeps_saved_candles(
    clean: Engine, broker: BrokerData, targeted: bool
) -> None:
    _seed(clean, broker, [FIRST, MIDDLE, LAST])
    with Session(clean) as db:
        job = queue_download(
            db, symbols=["INFY"], timeframe="1d", first=MIDDLE if targeted else FIRST,
            last=MIDDLE if targeted else LAST, segment="equity_delivery",
        )  # fmt: skip
        db.commit()
        job_id = job.id

    def incomplete(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={"candles": [] if targeted else [_bar(FIRST), _bar(LAST)]})

    client = BrokerData("http://broker", "test", transport=httpx2.MockTransport(incomplete))
    try:
        with Session(clean) as db:
            run_download(db, job_id, client, Pacer(sleep=lambda _: None))
            finished = db.get(DataJob, job_id)
            assert finished is not None and finished.status == "failed"
            assert finished.error and "INFY: 1" in finished.error
            assert "broker returned no usable" in finished.error
            assert db.scalar(select(func.count()).select_from(Candle)) == 2
    finally:
        client.close()


def test_gap_outside_requested_range_does_not_fail_download(
    clean: Engine, broker: BrokerData
) -> None:
    _seed(clean, broker, [FIRST, MIDDLE, LAST])
    with Session(clean) as db:
        job = queue_download(
            db, symbols=["INFY"], timeframe="1d", first=LAST, last=LAST,
            segment="equity_delivery",
        )  # fmt: skip
        db.commit()
        run_download(db, job.id, broker, Pacer(sleep=lambda _: None))
        assert job.status == "completed" and job.error is None


def test_later_listing_does_not_create_false_missing_days(
    clean: Engine, broker: BrokerData
) -> None:
    with Session(clean) as db:
        sync_instruments(db, broker, today=LAST)
        db.add_all(
            CandleDay(exchange="NSE", symbol="NIFTY 50", timeframe="1d", day=day, bars=1)
            for day in (FIRST, MIDDLE, LAST)
        )
        db.commit()
        job = queue_download(
            db, symbols=["INFY"], timeframe="1d", first=FIRST, last=LAST,
            segment="equity_delivery",
        )  # fmt: skip
        db.commit()
        job_id = job.id

    def listed(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json={"candles": [_bar(LAST)]})

    client = BrokerData("http://broker", "test", transport=httpx2.MockTransport(listed))
    try:
        with Session(clean) as db:
            run_download(db, job_id, client, Pacer(sleep=lambda _: None))
            finished = db.get(DataJob, job_id)
            assert finished is not None and finished.status == "completed"
            assert finished.error is None
    finally:
        client.close()
