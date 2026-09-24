from datetime import UTC, date, datetime

import pytest
from nova_atlas.broker_client import BrokerData
from nova_atlas.cli import queue_download
from nova_atlas.download import plan_chunks, run_download, to_paise, to_row
from nova_atlas.universe import sync_instruments
from nova_db.models import AuditEntry, Candle, DataJob
from nova_testing.broker import FakeBroker
from sqlalchemy import Engine, func, select, update
from sqlalchemy.orm import Session


@pytest.fixture
def synced(clean: Engine, broker: BrokerData) -> Engine:
    with Session(clean) as db:
        sync_instruments(db, broker, today=date(2026, 9, 25))
    return clean


def _queue(engine: Engine, symbols: list[str], timeframe: str, first: date, last: date) -> str:
    with Session(engine) as db:
        job = queue_download(
            db,
            symbols=symbols,
            timeframe=timeframe,
            first=first,
            last=last,
            segment="equity_delivery",
        )
        db.commit()
        return job.id


def test_chunks_follow_kite_request_sizes() -> None:
    chunks = plan_chunks(date(2026, 1, 1), date(2026, 5, 30), "1m")

    assert [(c.start.date(), c.end.date()) for c in chunks] == [
        (date(2026, 1, 1), date(2026, 3, 1)),
        (date(2026, 3, 2), date(2026, 4, 30)),
        (date(2026, 5, 1), date(2026, 5, 30)),
    ]
    assert len(plan_chunks(date(2020, 1, 1), date(2026, 1, 1), "1d")) == 2


@pytest.mark.parametrize(
    ("rupees", "paise"), [(1500.35, 150035), (0.05, 5), ("2.675", 268), (10, 1000)]
)
def test_prices_become_exact_paise(rupees: float | str, paise: int) -> None:
    assert to_paise(rupees) == paise


def test_bars_that_break_ohlc_rules_are_skipped() -> None:
    good = ["2026-09-24T00:00:00+0530", 10, 12, 9, 11, 100]

    row = to_row("NSE", "INFY", "1d", good)
    assert row is not None and row["ts"] == datetime(2026, 9, 23, 18, 30, tzinfo=UTC)
    assert to_row("NSE", "INFY", "1d", ["2026-09-24T00:00:00+0530", 10, 9, 8, 11, 100]) is None
    assert to_row("NSE", "INFY", "1d", ["2026-09-24T00:00:00+0530", 0, 12, 0, 11, 100]) is None


def test_download_fills_candles_and_completes(synced: Engine, broker: BrokerData) -> None:
    job_id = _queue(synced, ["INFY", "TCS"], "1d", date(2026, 9, 1), date(2026, 9, 30))

    with Session(synced) as db:
        run_download(db, job_id, broker)
        job = db.get(DataJob, job_id)
        count = db.scalar(select(func.count()).select_from(Candle))

    assert job is not None and job.status == "completed" and job.progress_percent == 100
    assert job.rows_written == 44 and count == 44  # 22 weekdays × 2 symbols
    assert job.finished_at is not None and job.error is None


def test_downloads_are_idempotent(synced: Engine, broker: BrokerData) -> None:
    for _ in range(2):
        job_id = _queue(synced, ["INFY"], "1d", date(2026, 9, 1), date(2026, 9, 30))
        with Session(synced) as db:
            run_download(db, job_id, broker)

    with Session(synced) as db:
        assert db.scalar(select(func.count()).select_from(Candle)) == 22


def test_unknown_instruments_fail_the_job(clean: Engine, broker: BrokerData) -> None:
    job_id = _queue(clean, ["INFY"], "1d", date(2026, 9, 1), date(2026, 9, 5))

    with Session(clean) as db:
        run_download(db, job_id, broker)
        job = db.get(DataJob, job_id)

    assert job is not None and job.status == "failed"
    assert job.error == "Unknown instruments: INFY (run sync-instruments)"


def test_broker_errors_fail_the_job(
    synced: Engine, broker: BrokerData, fake_broker: FakeBroker
) -> None:
    job_id = _queue(synced, ["INFY"], "1d", date(2026, 9, 1), date(2026, 9, 5))
    fake_broker.error = "Log in to Kite in Relay first: no account has a live session"

    with Session(synced) as db:
        run_download(db, job_id, broker)
        job = db.get(DataJob, job_id)

    assert job is not None and job.status == "failed"
    assert job.error is not None and job.error.startswith("Log in to Kite")


def test_a_cancelled_job_stops(synced: Engine, broker: BrokerData) -> None:
    job_id = _queue(synced, ["INFY", "TCS"], "1d", date(2026, 9, 1), date(2026, 9, 5))
    with Session(synced) as db:
        db.execute(update(DataJob).values(status="cancelled"))
        db.commit()
        run_download(db, job_id, broker)
        job = db.get(DataJob, job_id)

    assert job is not None and job.status == "cancelled" and job.rows_written == 0


@pytest.mark.parametrize(
    ("symbols", "timeframe", "first", "last", "message"),
    [
        (["NOPE"], "1d", date(2026, 1, 1), date(2026, 1, 2), "Not in universe"),
        (["INFY"], "2h", date(2026, 1, 1), date(2026, 1, 2), "Timeframe"),
        (["INFY"], "1d", date(2026, 2, 1), date(2026, 1, 2), "on or before"),
        ([], "1d", date(2026, 1, 1), date(2026, 1, 2), "symbols"),
    ],
)
def test_queue_download_validates_its_input(
    clean: Engine, symbols: list[str], timeframe: str, first: date, last: date, message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        _queue(clean, symbols, timeframe, first, last)


def test_queue_download_is_audited(clean: Engine) -> None:
    job_id = _queue(clean, ["INFY"], "1d", date(2026, 9, 1), date(2026, 9, 5))

    with Session(clean) as db:
        entry = db.scalars(select(AuditEntry)).one()
    assert entry.action == "data_job.create" and entry.target_id == job_id
