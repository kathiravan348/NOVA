"""Data jobs (D32, D41, D54): list, one job, queue a download, cancel."""

import json
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import CallerDep
from nova_contracts import (
    PAGE_LIMIT_DEFAULT,
    PAGE_LIMIT_MAX,
    ArchiveJobCreate,
    DataJobCreate,
    DataJobPlan,
    Page,
)
from nova_contracts import DataJob as DataJobContract
from nova_contracts.data_job import DataJobType
from nova_db import new_id
from nova_db.audit import record_audit
from nova_db.models import DataJob
from nova_db.paging import newest_first
from nova_db.web import Db
from sqlalchemy.orm import Session

from nova_atlas.archive import IST, archive_days, archive_symbols
from nova_atlas.plan import create_download

router = APIRouter()

# The CLI has no signed-in user.
CONSOLE = "Console"


def queue_download(
    db: Session,
    *,
    symbols: list[str],
    timeframe: str,
    first: date,
    last: date,
    segment: str,
    actor_id: str | None = None,
    actor_name: str = CONSOLE,
    ip: str | None = None,
) -> DataJob:
    """Plans a download that skips stored candles and queues it at once (the pre-D57 flow)."""
    return create_download(
        db,
        symbols=symbols,
        timeframe=timeframe,
        first=first,
        last=last,
        segment=segment,
        mode="skip_existing",
        start=True,
        actor_id=actor_id,
        actor_name=actor_name,
        ip=ip,
    )


def queue_archive(
    db: Session,
    *,
    before: date,
    actor_id: str | None = None,
    actor_name: str = CONSOLE,
    ip: str | None = None,
) -> DataJob:
    """Adds a `queued` archive of every tick received before `before` (IST) and audits it."""
    if before > datetime.now(IST).date():
        raise ValueError("The date must be today or earlier")
    days = archive_days(db, before)
    if not days:
        raise ValueError(f"No ticks before {before.isoformat()}")
    job = DataJob(
        id=new_id("job"),
        type="archive",
        status="queued",
        exchange="NSE",
        segment="equity_delivery",
        symbols=archive_symbols(db, before),
        timeframe=None,
        date_from=days[0],
        date_to=before - timedelta(days=1),
    )
    db.add(job)
    record_audit(
        db,
        action="data_job.create",
        actor_id=actor_id,
        actor_name=actor_name,
        summary=f"Queued archive of ticks before {before.isoformat()}",
        target_type="data_job",
        target_id=job.id,
        ip=ip,
    )
    return job


def _describe(job: DataJob) -> str:
    if job.type == "historical_download":
        return f"{job.timeframe} download of {len(job.symbols)} symbol(s)"
    if job.type == "archive":
        return f"archive of {len(job.symbols)} symbol(s)"
    return f"tick recording of {len(job.symbols)} symbol(s)"


def cancel_job(
    db: Session, job: DataJob, *, actor_id: str | None, actor_name: str, ip: str | None
) -> None:
    """Waiting jobs end now; a running job stops at its next checkpoint (the worker checks)."""
    if job.status not in ("draft", "queued", "running", "paused"):
        raise ValueError(f"Job is already {job.status}")
    if job.status != "running":
        job.finished_at = datetime.now(UTC)
    job.expires_at = None
    job.status = "cancelled"
    record_audit(
        db,
        action="data_job.cancel",
        actor_id=actor_id,
        actor_name=actor_name,
        summary=f"Cancelled {_describe(job)}",
        target_type="data_job",
        target_id=job.id,
        ip=ip,
    )


def to_contract(job: DataJob) -> DataJobContract:
    return DataJobContract.model_validate(
        {
            "id": job.id,
            "type": job.type,
            "status": job.status,
            "exchange": job.exchange,
            "segment": job.segment,
            "symbols": job.symbols,
            "timeframe": job.timeframe,
            "from_": job.date_from,
            "to": job.date_to,
            "progress_percent": float(job.progress_percent),
            "rows_written": job.rows_written,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
            "error": job.error,
            "summary": job.summary,
            "mode": job.mode,
            # Stored as the contract's JSON (camelCase), so it is read back the same way.
            "plan": DataJobPlan.model_validate_json(json.dumps(job.plan)) if job.plan else None,
            "steps_done": job.steps_done,
            "steps_total": job.steps_total,
            "expires_at": job.expires_at,
        }
    )


def _job(db: Session, job_id: str) -> DataJob:
    job = db.get(DataJob, job_id)
    if job is None:
        raise ApiException(404, "not_found", f"Data job {job_id} not found")
    return job


@router.get("/data-jobs")
def list_jobs(
    _: CallerDep,
    db: Db,
    limit: Annotated[int, Query(ge=1, le=PAGE_LIMIT_MAX)] = PAGE_LIMIT_DEFAULT,
    cursor: Annotated[str | None, Query(min_length=1)] = None,
    job_type: Annotated[DataJobType | None, Query(alias="type")] = None,
) -> JSONResponse:
    """Newest first; `type` keeps one kind (e.g. the latest `instrument_sync`, D56)."""
    where = [DataJob.type == job_type] if job_type else []
    rows, next_cursor = newest_first(
        db, DataJob, DataJob.created_at, DataJob.id, limit=limit, cursor=cursor, where=where
    )
    page = Page[DataJobContract](items=[to_contract(r) for r in rows], next_cursor=next_cursor)
    return JSONResponse(page.model_dump(mode="json"))


@router.post("/data-jobs", status_code=201)
def create_job(body: DataJobCreate, caller: CallerDep, db: Db) -> JSONResponse:
    try:
        job = queue_download(
            db,
            symbols=body.symbols,
            timeframe=body.timeframe,
            first=body.from_,
            last=body.to,
            segment=body.segment,
            actor_id=caller.id,
            actor_name=caller.name,
            ip=caller.ip,
        )
    except ValueError as exc:
        raise ApiException(400, "invalid_request", str(exc)) from exc
    db.commit()
    return JSONResponse(to_contract(job).model_dump(mode="json"), status_code=201)


@router.get("/data-jobs/{job_id}")
def get_job(job_id: str, _: CallerDep, db: Db) -> JSONResponse:
    return JSONResponse(to_contract(_job(db, job_id)).model_dump(mode="json"))


@router.post("/data-jobs/{job_id}/cancel")
def cancel(job_id: str, caller: CallerDep, db: Db) -> JSONResponse:
    job = _job(db, job_id)
    try:
        cancel_job(db, job, actor_id=caller.id, actor_name=caller.name, ip=caller.ip)
    except ValueError as exc:
        raise ApiException(400, "invalid_request", str(exc)) from exc
    db.commit()
    return JSONResponse(to_contract(job).model_dump(mode="json"))


@router.post("/data-jobs/archive", status_code=201)
def create_archive(body: ArchiveJobCreate, caller: CallerDep, db: Db) -> JSONResponse:
    try:
        job = queue_archive(
            db, before=body.before, actor_id=caller.id, actor_name=caller.name, ip=caller.ip
        )
    except ValueError as exc:
        raise ApiException(400, "invalid_request", str(exc)) from exc
    db.commit()
    return JSONResponse(to_contract(job).model_dump(mode="json"), status_code=201)
