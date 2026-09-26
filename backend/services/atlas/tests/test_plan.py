from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from nova_atlas.broker_client import BrokerData
from nova_atlas.download import Pacer, run_download
from nova_atlas.job_control import expire_drafts
from nova_atlas.jobs import queue_download
from nova_atlas.plan import build_plan, is_covered
from nova_atlas.universe import sync_instruments
from nova_db.models import AuditEntry, DataJob, DataJobStep
from nova_testing.parity import Parity
from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session

SATURDAY = datetime(2026, 9, 26, 6, 0, tzinfo=UTC)
FIRST, LAST = date(2026, 7, 1), date(2026, 9, 25)  # two 1m chunks: Jul 1-Aug 29, Aug 30-Sep 25
BODY = {"symbols": ["INFY", "TCS"], "timeframe": "1d", "from": "2026-09-01", "to": "2026-09-25"}


def no_wait() -> Pacer:
    return Pacer(sleep=lambda _: None)


@pytest.fixture
def synced(clean: Engine, broker: BrokerData) -> Engine:
    with Session(clean) as db:
        sync_instruments(db, broker, today=date(2026, 9, 25))
    return clean


def _weekdays(first: date, last: date) -> int:
    days = (first + timedelta(days=n) for n in range((last - first).days + 1))
    return sum(1 for day in days if day.weekday() < 5)


def _store_infy(engine: Engine, broker: BrokerData) -> None:
    with Session(engine) as db:
        job = queue_download(
            db, symbols=["INFY"], timeframe="1m", first=FIRST, last=LAST, segment="equity_delivery"
        )
        db.commit()
        run_download(db, job.id, broker, no_wait())


def test_coverage_allows_weekends_but_not_long_gaps() -> None:
    weekdays = [date(2026, 9, d) for d in (1, 2, 3, 4, 7, 8, 9, 10, 11)]

    assert is_covered(weekdays, date(2026, 9, 1), date(2026, 9, 13))
    assert not is_covered(weekdays, date(2026, 8, 20), date(2026, 9, 13))  # starts too late
    hole = [date(2026, 9, 1), date(2026, 9, 11)]
    assert not is_covered(hole, date(2026, 9, 1), date(2026, 9, 11))
    assert not is_covered([], date(2026, 9, 1), date(2026, 9, 2))


def test_stored_stock_is_skipped_and_estimates_are_exact(
    synced: Engine, broker: BrokerData
) -> None:
    _store_infy(synced, broker)

    with Session(synced) as db:
        plan, steps = build_plan(
            db,
            symbols=["INFY", "TCS", "RELIANCE"],
            timeframe="1m",
            first=FIRST,
            last=LAST,
            mode="skip_existing",
            now=SATURDAY,
        )

    days = _weekdays(date(2026, 7, 1), date(2026, 8, 29)) + _weekdays(date(2026, 8, 30), LAST)
    rows = days * 375
    assert [(s.symbol, s.skipped) for s in steps] == [
        ("INFY", True), ("INFY", True), ("TCS", False), ("TCS", False),
        ("RELIANCE", False), ("RELIANCE", False),
    ]  # fmt: skip
    assert (plan.steps, plan.skipped_steps, plan.requests) == (6, 2, 4)
    assert plan.estimated_rows == 2 * rows and plan.estimated_bytes == 2 * rows * 80
    assert plan.estimated_seconds == 3  # 4 requests x 0.5 s (Saturday) + 20%, rounded up
    assert plan.estimated_start_at == SATURDAY and plan.jobs_ahead == 0
    infy = plan.per_symbol[0]
    assert (infy.existing_from, infy.existing_to) == (FIRST, LAST)
    assert plan.warnings == []


def test_overwrite_skips_nothing_and_warns_about_old_intraday_ranges(
    synced: Engine, broker: BrokerData
) -> None:
    _store_infy(synced, broker)

    with Session(synced) as db:
        plan, _ = build_plan(
            db, symbols=["INFY"], timeframe="1m", first=FIRST, last=LAST,
            mode="overwrite", now=SATURDAY,
        )  # fmt: skip
        old, _ = build_plan(
            db, symbols=["INFY"], timeframe="1d", first=date(2014, 1, 1), last=LAST,
            mode="overwrite", now=SATURDAY,
        )  # fmt: skip
        intraday_old, _ = build_plan(
            db, symbols=["INFY"], timeframe="5m", first=date(2014, 12, 1), last=date(2015, 1, 5),
            mode="overwrite", now=SATURDAY,
        )  # fmt: skip

    assert plan.skipped_steps == 0 and plan.requests == 2
    assert old.warnings == []
    assert any("2015" in w for w in intraday_old.warnings)


def test_market_hours_slow_the_estimate(synced: Engine) -> None:
    thursday_10am_ist = datetime(2026, 9, 24, 4, 30, tzinfo=UTC)

    with Session(synced) as db:
        plan, _ = build_plan(
            db, symbols=["TCS"], timeframe="1d", first=FIRST, last=LAST,
            mode="skip_existing", now=thursday_10am_ist,
        )  # fmt: skip

    assert plan.requests == 1 and plan.estimated_seconds == 2  # 1 s in market hours + 20%


def test_plan_start_pause_resume_and_cancel_over_http(
    synced: Engine, client: TestClient, parity: Parity
) -> None:
    planned = client.post("/api/v1/data-jobs/plan", json=BODY)
    assert planned.status_code == 201
    job = planned.json()
    parity.assert_valid(job, "DataJob")
    assert job["status"] == "draft" and job["mode"] == "skip_existing"
    assert job["stepsTotal"] == 2 and job["plan"]["requests"] == 2 and job["expiresAt"]
    path = f"/api/v1/data-jobs/{job['id']}"

    started = client.post(f"{path}/start").json()
    assert started["status"] == "queued" and started["expiresAt"] is None
    assert client.post(f"{path}/start").status_code == 400
    assert client.post(f"{path}/resume").status_code == 400
    assert client.post(f"{path}/pause").json()["status"] == "paused"
    assert client.post(f"{path}/resume").json()["status"] == "queued"
    assert client.post(f"{path}/pause").status_code == 200
    assert client.post(f"{path}/cancel").json()["status"] == "cancelled"
    assert client.post(f"{path}/pause").status_code == 400
    assert client.post("/api/v1/data-jobs/job_missing/start").status_code == 404

    with Session(synced) as db:
        actions = list(
            db.scalars(
                select(AuditEntry.action)
                .where(AuditEntry.target_id == job["id"])
                .order_by(AuditEntry.at, AuditEntry.id)
            )
        )
    assert actions == [
        "data_job.plan", "data_job.start", "data_job.pause", "data_job.resume",
        "data_job.pause", "data_job.cancel",
    ]  # fmt: skip


def test_a_bad_plan_is_refused(synced: Engine, client: TestClient) -> None:
    unknown = client.post("/api/v1/data-jobs/plan", json=BODY | {"symbols": ["NOPE"]})
    bad_mode = client.post("/api/v1/data-jobs/plan", json=BODY | {"mode": "append"})

    assert unknown.status_code == 400 and "NOPE" in unknown.json()["error"]["message"]
    assert bad_mode.status_code == 400


@pytest.mark.parametrize("path", ["/api/v1/data-jobs/plan", "/api/v1/data-jobs"])
def test_only_1m_and_1d_can_be_downloaded(synced: Engine, client: TestClient, path: str) -> None:
    response = client.post(path, json=BODY | {"timeframe": "5m"})

    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Download 1m or 1d; 3m to 1h are built from 1m"


def test_an_expired_plan_cannot_start_and_is_cancelled(synced: Engine, client: TestClient) -> None:
    job_id = client.post("/api/v1/data-jobs/plan", json=BODY).json()["id"]
    past = datetime.now(UTC) - timedelta(minutes=1)
    with Session(synced) as db:
        db.execute(update(DataJob).where(DataJob.id == job_id).values(expires_at=past))
        db.commit()

    refused = client.post(f"/api/v1/data-jobs/{job_id}/start")
    with Session(synced) as db:
        expired = expire_drafts(db)
        job = db.get(DataJob, job_id)

    assert refused.status_code == 400 and "expired" in refused.json()["error"]["message"]
    assert expired == 1 and job is not None and job.status == "cancelled"
    assert job.expires_at is None and job.finished_at is not None


def test_download_settings_are_read_changed_and_audited(
    synced: Engine, client: TestClient, parity: Parity
) -> None:
    assert client.get("/api/v1/data-jobs/settings").json() == {"marketHoursMode": "slow"}

    changed = client.patch("/api/v1/data-jobs/settings", json={"marketHoursMode": "full"})
    bad = client.patch("/api/v1/data-jobs/settings", json={"marketHoursMode": "fast"})

    assert changed.json() == {"marketHoursMode": "full"}
    parity.assert_valid(changed.json(), "DownloadSettings")
    assert bad.status_code == 400
    assert client.get("/api/v1/data-jobs/settings").json() == {"marketHoursMode": "full"}
    with Session(synced) as db:
        audit = db.scalars(
            select(AuditEntry).where(AuditEntry.action == "download_settings.update")
        ).one()
        client.patch("/api/v1/data-jobs/settings", json={"marketHoursMode": "slow"})
    assert audit.summary == "Full pace in market hours" and audit.actor_id == "usr_owner"


def test_old_create_endpoint_plans_and_queues_at_once(synced: Engine, client: TestClient) -> None:
    job = client.post("/api/v1/data-jobs", json=BODY).json()

    with Session(synced) as db:
        steps = db.scalars(select(DataJobStep).where(DataJobStep.job_id == job["id"])).all()

    assert job["status"] == "queued" and job["mode"] == "skip_existing" and job["stepsTotal"] == 2
    assert [s.status for s in steps] == ["pending", "pending"]
