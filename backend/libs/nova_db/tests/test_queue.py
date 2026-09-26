from datetime import UTC, date, datetime, timedelta

from nova_db.models import DataJob
from nova_db.queue import claim_next, fail_running, requeue_running
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

NOW = datetime(2026, 9, 26, 6, 0, tzinfo=UTC)


def _download(job_id: str, status: str, **over: object) -> DataJob:
    fields: dict[str, object] = {
        "id": job_id,
        "type": "historical_download",
        "status": status,
        "exchange": "NSE",
        "segment": "equity_delivery",
        "symbols": ["INFY"],
        "timeframe": "1d",
        "date_from": date(2025, 1, 1),
        "date_to": date(2025, 12, 31),
        "mode": "skip_existing",
    }
    return DataJob(**(fields | over))


def test_draft_and_paused_jobs_are_never_claimed(engine: Engine) -> None:
    with Session(engine) as db:
        db.execute(text("TRUNCATE data_jobs CASCADE"))
        db.add(_download("job_a", "draft", plan={"steps": 1}, expires_at=NOW + timedelta(hours=24)))
        db.add(_download("job_b", "paused", started_at=NOW))
        db.commit()

        assert claim_next(db, DataJob) is None

        db.add(_download("job_c", "queued"))
        db.commit()
        assert claim_next(db, DataJob) == "job_c"


def test_requeue_leaves_paused_jobs_and_steps_alone(engine: Engine) -> None:
    with Session(engine) as db:
        db.execute(text("TRUNCATE data_jobs CASCADE"))
        db.add(_download("job_p", "paused", started_at=NOW))
        db.add(_download("job_r", "running", started_at=NOW))
        db.commit()
        db.execute(
            text(
                "INSERT INTO data_job_steps (job_id, seq, symbol, start_at, end_at, status,"
                " rows_written, finished_at) VALUES ('job_r', 0, 'INFY', now() - interval '1 day',"
                " now(), 'done', 10, now())"
            )
        )
        db.commit()

        assert requeue_running(db, DataJob) == 1
        statuses = dict(db.execute(text("SELECT id, status FROM data_jobs")).tuples().all())
        steps = db.execute(text("SELECT status FROM data_job_steps")).scalars().all()
        db.execute(text("TRUNCATE data_jobs CASCADE"))
        db.commit()

    assert statuses == {"job_p": "paused", "job_r": "queued"}
    assert steps == ["done"]


def test_fail_running_honours_the_condition(engine: Engine) -> None:
    with Session(engine) as db:
        db.execute(text("TRUNCATE data_jobs CASCADE"))
        db.add(_download("job_1d", "running", started_at=NOW))
        db.add(_download("job_1m", "running", started_at=NOW, timeframe="1m"))
        db.add(_download("job_q", "queued"))
        db.commit()

        assert fail_running(db, DataJob, "stopped", DataJob.timeframe == "1m") == 1
        rows = db.execute(text("SELECT id, status, error FROM data_jobs ORDER BY id")).all()
        finished = db.execute(
            text("SELECT finished_at IS NOT NULL FROM data_jobs WHERE id = 'job_1m'")
        ).scalar_one()
        db.execute(text("TRUNCATE data_jobs CASCADE"))
        db.commit()

    assert [tuple(r) for r in rows] == [
        ("job_1d", "running", None),
        ("job_1m", "failed", "stopped"),
        ("job_q", "queued", None),
    ]
    assert finished
