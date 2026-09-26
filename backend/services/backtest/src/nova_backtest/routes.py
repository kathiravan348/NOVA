"""Backtest runs, results and trades (D25, D32), and queueing a run (D44)."""

from typing import Annotated, Literal

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import CallerDep
from nova_contracts import (
    PAGE_LIMIT_DEFAULT,
    PAGE_LIMIT_MAX,
    BacktestDeleteRequest,
    BacktestRunCreate,
    BacktestVersionCreate,
    Page,
)
from nova_contracts import BacktestRun as RunContract
from nova_contracts import Trade as TradeContract
from nova_db import new_id
from nova_db.audit import record_audit
from nova_db.models import BacktestResult, BacktestRun, StrategyVersion, Trade
from nova_db.paging import newest_first, oldest_first
from nova_db.web import Db
from sqlalchemy import exists
from sqlalchemy.orm import Session, aliased

from nova_backtest.convert import result_contract, run_contract, trade_contract
from nova_backtest.versions import (
    add_version,
    check_symbols,
    delete_backtests,
    delete_version,
    list_versions,
)

router = APIRouter(prefix="/backtests")

Limit = Annotated[int, Query(ge=1, le=PAGE_LIMIT_MAX)]
Cursor = Annotated[str | None, Query(min_length=1)]


def _run(db: Session, run_id: str) -> BacktestRun:
    run = db.get(BacktestRun, run_id)
    if run is None:
        raise ApiException(404, "not_found", f"Backtest run {run_id} not found")
    return run


@router.get("")
def list_runs(
    _: CallerDep,
    db: Db,
    strategy_id: Annotated[str | None, Query(alias="strategyId", min_length=1)] = None,
    limit: Limit = PAGE_LIMIT_DEFAULT,
    cursor: Cursor = None,
) -> JSONResponse:
    # Only the newest version of each backtest (D60).
    newer = aliased(BacktestRun)
    where = [
        ~exists().where(newer.root_id == BacktestRun.root_id, newer.version > BacktestRun.version)
    ]
    if strategy_id:
        where.append(BacktestRun.strategy_id == strategy_id)
    rows, next_cursor = newest_first(
        db,
        BacktestRun,
        BacktestRun.created_at,
        BacktestRun.id,
        limit=limit,
        cursor=cursor,
        where=where,
    )
    page = Page[RunContract](items=[run_contract(r) for r in rows], next_cursor=next_cursor)
    return JSONResponse(page.model_dump(mode="json"))


@router.get("/{run_id}")
def get_run(run_id: str, _: CallerDep, db: Db) -> JSONResponse:
    return JSONResponse(run_contract(_run(db, run_id)).model_dump(mode="json"))


@router.get("/{run_id}/result")
def get_result(run_id: str, _: CallerDep, db: Db) -> JSONResponse:
    _run(db, run_id)
    result = db.get(BacktestResult, run_id)
    if result is None:
        raise ApiException(404, "not_found", f"Backtest result for run {run_id} not found")
    return JSONResponse(result_contract(result).model_dump(mode="json"))


@router.get("/{run_id}/trades")
def list_trades(
    run_id: str, _: CallerDep, db: Db, limit: Limit = PAGE_LIMIT_DEFAULT, cursor: Cursor = None
) -> JSONResponse:
    _run(db, run_id)
    rows, next_cursor = oldest_first(
        db,
        Trade,
        Trade.entry_at,
        Trade.id,
        limit=limit,
        cursor=cursor,
        where=[Trade.run_id == run_id],
    )
    page = Page[TradeContract](items=[trade_contract(r) for r in rows], next_cursor=next_cursor)
    return JSONResponse(page.model_dump(mode="json"))


@router.post("")
def queue_run(body: BacktestRunCreate, caller: CallerDep, db: Db) -> JSONResponse:
    version = db.get(StrategyVersion, (body.strategy_id, body.strategy_version))
    if version is None:
        raise ApiException(
            404,
            "not_found",
            f"Strategy {body.strategy_id} version {body.strategy_version} not found",
        )
    universe = body.universe.model_dump(mode="json")
    check_symbols(db, universe)
    run_id = new_id("run")
    run = BacktestRun(
        id=run_id,
        root_id=run_id,
        strategy_id=body.strategy_id,
        strategy_version=body.strategy_version,
        name=body.name,
        universe=universe,
        status="queued",
        date_from=body.from_,
        date_to=body.to,
        initial_capital_paise=body.initial_capital_paise,
        benchmark=body.benchmark,
    )
    db.add(run)
    record_audit(
        db,
        action="backtest.run",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"Queued backtest {body.name}",
        target_type="backtest",
        target_id=run.id,
        ip=caller.ip,
    )
    db.commit()
    return JSONResponse(run_contract(_run(db, run.id)).model_dump(mode="json"), status_code=201)


@router.get("/{run_id}/versions")
def get_versions(run_id: str, _: CallerDep, db: Db) -> JSONResponse:
    """Every version of the backtest this run belongs to, newest first (D60)."""
    body = [v.model_dump(mode="json") for v in list_versions(db, run_id)]
    return JSONResponse(body)


@router.post("/{run_id}/versions")
def post_version(
    run_id: str, body: BacktestVersionCreate, caller: CallerDep, db: Db
) -> JSONResponse:
    """Edit: queues the next version (D60)."""
    run = add_version(db, run_id, body, caller)
    return JSONResponse(run_contract(_run(db, run.id)).model_dump(mode="json"), status_code=201)


@router.delete("/{run_id}")
def delete_run(
    run_id: str, caller: CallerDep, db: Db, scope: Literal["all", "version"] = "all"
) -> JSONResponse:
    """`all`: the whole backtest, every version; `version`: this older version only (D60)."""
    result = (
        delete_version(db, run_id, caller)
        if scope == "version"
        else delete_backtests(db, [run_id], caller)
    )
    return JSONResponse(result.model_dump(mode="json"))


@router.post("/delete")
def delete_many(body: BacktestDeleteRequest, caller: CallerDep, db: Db) -> JSONResponse:
    """Whole backtests, every version of each (D60)."""
    return JSONResponse(delete_backtests(db, body.ids, caller).model_dump(mode="json"))
