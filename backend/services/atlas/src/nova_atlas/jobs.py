"""`GET /data-jobs` (paged, D32) and `GET /data-jobs/{id}`."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import Caller, internal_caller
from nova_contracts import PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX, Page
from nova_contracts import DataJob as DataJobContract
from nova_db.models import DataJob
from nova_db.paging import newest_first
from nova_db.web import Db

router = APIRouter()


def require_caller(request: Request) -> Caller:
    return internal_caller(request, request.app.state.settings.internal_token)


CallerDep = Annotated[Caller, Depends(require_caller)]


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
        }
    )


@router.get("/data-jobs")
def list_jobs(
    _: CallerDep,
    db: Db,
    limit: Annotated[int, Query(ge=1, le=PAGE_LIMIT_MAX)] = PAGE_LIMIT_DEFAULT,
    cursor: Annotated[str | None, Query(min_length=1)] = None,
) -> JSONResponse:
    rows, next_cursor = newest_first(
        db, DataJob, DataJob.created_at, DataJob.id, limit=limit, cursor=cursor
    )
    page = Page[DataJobContract](items=[to_contract(r) for r in rows], next_cursor=next_cursor)
    return JSONResponse(page.model_dump(mode="json"))


@router.get("/data-jobs/{job_id}")
def get_job(job_id: str, _: CallerDep, db: Db) -> JSONResponse:
    job = db.get(DataJob, job_id)
    if job is None:
        raise ApiException(404, "not_found", f"Data job {job_id} not found")
    return JSONResponse(to_contract(job).model_dump(mode="json"))
