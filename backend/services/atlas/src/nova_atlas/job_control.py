"""Planned downloads over HTTP (D57): plan, Start, Pause, Resume, download settings.

Included before `jobs.router`, so `/data-jobs/settings` is not read as a job id.
"""

from datetime import UTC, datetime, time, timedelta

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import Caller, CallerDep
from nova_contracts import (
    DataJobDeleteResult,
    DataJobPlanRequest,
    DownloadSettings,
    DownloadSettingsUpdate,
)
from nova_db.audit import record_audit
from nova_db.models import Candle, DataJob, DownloadSetting
from nova_db.web import Db
from sqlalchemy import delete, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from nova_atlas.download import IST, market_hours_mode
from nova_atlas.jobs import to_contract
from nova_atlas.plan import create_download

router = APIRouter(prefix="/data-jobs")

PACE_TEXT = {"slow": "Slow down in market hours", "full": "Full pace in market hours"}


def _job(db: Session, job_id: str) -> DataJob:
    job = db.get(DataJob, job_id)
    if job is None:
        raise ApiException(404, "not_found", f"Data job {job_id} not found")
    return job


def _audit(db: Session, caller: Caller, action: str, job: DataJob, summary: str) -> None:
    record_audit(
        db,
        action=action,
        actor_id=caller.id,
        actor_name=caller.name,
        summary=summary,
        target_type="data_job",
        target_id=job.id,
        ip=caller.ip,
    )


def _answer(db: Session, job: DataJob, status_code: int = 200) -> JSONResponse:
    db.commit()
    return JSONResponse(to_contract(job).model_dump(mode="json"), status_code=status_code)


@router.post("/plan", status_code=201)
def plan(body: DataJobPlanRequest, caller: CallerDep, db: Db) -> JSONResponse:
    """A `draft` download with its steps and plan; nothing runs until Start (D57 (2))."""
    try:
        job = create_download(
            db,
            symbols=body.symbols,
            timeframe=body.timeframe,
            first=body.from_,
            last=body.to,
            segment=body.segment,
            mode=body.mode,
            start=False,
            actor_id=caller.id,
            actor_name=caller.name,
            ip=caller.ip,
        )
    except ValueError as exc:
        raise ApiException(400, "invalid_request", str(exc)) from exc
    return _answer(db, job, 201)


@router.post("/{job_id}/start")
def start(job_id: str, caller: CallerDep, db: Db) -> JSONResponse:
    job = _job(db, job_id)
    if job.status != "draft":
        raise ApiException(
            400, "invalid_request", f"Only a planned job can start; it is {job.status}"
        )
    if job.expires_at is not None and job.expires_at <= datetime.now(UTC):
        raise ApiException(400, "invalid_request", "This plan expired. Plan the download again.")
    job.status, job.expires_at = "queued", None
    _audit(
        db,
        caller,
        "data_job.start",
        job,
        f"Started {job.timeframe} download of {len(job.symbols)} symbol(s)",
    )
    return _answer(db, job)


@router.post("/{job_id}/pause")
def pause(job_id: str, caller: CallerDep, db: Db) -> JSONResponse:
    """A running job stops after its current step (the worker checks before each one)."""
    job = _job(db, job_id)
    if job.type != "historical_download" or job.status not in ("queued", "running"):
        raise ApiException(
            400,
            "invalid_request",
            f"Only a waiting or running download can pause; it is {job.status}",
        )
    job.status = "paused"
    _audit(
        db,
        caller,
        "data_job.pause",
        job,
        f"Paused download at {job.steps_done}/{job.steps_total} steps",
    )
    return _answer(db, job)


@router.post("/{job_id}/resume")
def resume(job_id: str, caller: CallerDep, db: Db) -> JSONResponse:
    """Back in the queue; the worker continues from the next unfinished step."""
    job = _job(db, job_id)
    if job.status != "paused":
        raise ApiException(
            400, "invalid_request", f"Only a paused job can resume; it is {job.status}"
        )
    job.status, job.started_at = "queued", None
    _audit(
        db,
        caller,
        "data_job.resume",
        job,
        f"Resumed download at {job.steps_done}/{job.steps_total} steps",
    )
    return _answer(db, job)


def _settings(db: Session) -> JSONResponse:
    body = DownloadSettings(market_hours_mode=market_hours_mode(db))
    return JSONResponse(body.model_dump(mode="json"))


@router.get("/settings")
def get_settings(_: CallerDep, db: Db) -> JSONResponse:
    return _settings(db)


@router.patch("/settings")
def update_settings(body: DownloadSettingsUpdate, caller: CallerDep, db: Db) -> JSONResponse:
    values = {
        "market_hours_mode": body.market_hours_mode,
        "updated_at": datetime.now(UTC),
        "updated_by": caller.id,
    }
    # Upsert: the single row is seeded by migration 0011, but never assume it survived.
    db.execute(
        insert(DownloadSetting)
        .values(id=1, **values)
        .on_conflict_do_update(index_elements=["id"], set_=values)
    )
    record_audit(
        db,
        action="download_settings.update",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=PACE_TEXT[body.market_hours_mode],
        target_type="settings",
        target_id="downloads",
        ip=caller.ip,
    )
    db.commit()
    return _settings(db)


def expire_drafts(db: Session, now: datetime | None = None) -> int:
    """Plans not started within 24 h end as `cancelled` (the worker's idle loop runs this)."""
    now = now or datetime.now(UTC)
    expired = db.scalars(
        update(DataJob)
        .where(DataJob.status == "draft", DataJob.expires_at <= now)
        .values(
            status="cancelled", expires_at=None, finished_at=now, summary="Plan expired unstarted"
        )
        .returning(DataJob.id)
    ).all()
    db.commit()
    return len(expired)


DELETABLE = ("draft", "completed", "failed", "cancelled")
KIND = {
    "historical_download": "download",
    "tick_record": "tick recording",
    "archive": "archive",
    "instrument_sync": "stock-list sync",
}


def _delete_candles(db: Session, job: DataJob) -> int:
    """Candles of the job's stocks, timeframe and IST dates (other jobs' rows there go too)."""
    assert job.timeframe is not None and job.date_from is not None and job.date_to is not None
    start = datetime.combine(job.date_from, time(0, 0), tzinfo=IST)
    end = datetime.combine(job.date_to + timedelta(days=1), time(0, 0), tzinfo=IST)
    result = db.execute(
        delete(Candle).where(
            Candle.exchange == job.exchange,
            Candle.symbol.in_(job.symbols),
            Candle.timeframe == job.timeframe,
            Candle.ts >= start,
            Candle.ts < end,
        )
    )
    return int(result.rowcount or 0)  # type: ignore[attr-defined]


@router.delete("/{job_id}")
def delete_job(job_id: str, caller: CallerDep, db: Db, candles: bool = False) -> JSONResponse:
    """Removes a finished job (and its steps); `candles=true` also removes a download's candles."""
    job = _job(db, job_id)
    if job.status not in DELETABLE:
        raise ApiException(400, "invalid_request", "Cancel or finish the job first")
    if candles and job.type != "historical_download":
        raise ApiException(400, "invalid_request", "Only downloads have candles to delete")
    removed = _delete_candles(db, job) if candles else 0
    what = f"{job.timeframe} " if job.timeframe else ""
    summary = f"Deleted {what}{KIND[job.type]} of {len(job.symbols)} symbol(s)"
    if candles:
        summary += f" and {removed:,} candles"
    _audit(db, caller, "data_job.delete", job, summary)
    db.delete(job)
    db.commit()
    result = DataJobDeleteResult(id=job_id, candles_deleted=removed)
    return JSONResponse(result.model_dump(mode="json"))
