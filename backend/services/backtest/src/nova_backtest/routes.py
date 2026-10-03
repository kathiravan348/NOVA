"""Backtest runs, results and trades (D25, D32), and queueing a run (D44)."""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import CallerDep
from nova_contracts import (
    PAGE_LIMIT_DEFAULT,
    PAGE_LIMIT_MAX,
    BacktestDeleteRequest,
    BacktestListSort,
    BacktestRunCreate,
    BacktestRunListItem,
    BacktestRunStatus,
    BacktestVersionCreate,
    DataSource,
    LedgerDay,
    LedgerEvent,
    Page,
    Segment,
    StrategyTimeframe,
)
from nova_contracts import Trade as TradeContract
from nova_db import new_id
from nova_db.audit import record_audit
from nova_db.models import BacktestResult, BacktestRun, Trade
from nova_db.paging import oldest_first
from nova_db.web import Db
from sqlalchemy.orm import Session

from nova_backtest.convert import result_contract, run_contract, trade_contract
from nova_backtest.ledger import filter_days, timeline
from nova_backtest.ledger import load as load_ledger
from nova_backtest.listing import RunFilters
from nova_backtest.listing import list_runs as filtered_runs
from nova_backtest.versions import (
    add_version,
    check_benchmark,
    check_source,
    check_symbols,
    delete_backtests,
    delete_version,
    list_versions,
    strategy_spec,
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
    data_source: Annotated[DataSource | None, Query(alias="dataSource")] = None,
    status: BacktestRunStatus | None = None,
    q: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    segment: Segment | None = None,
    timeframe: StrategyTimeframe | None = None,
    min_return: Annotated[float | None, Query(alias="minReturn")] = None,
    min_cagr: Annotated[float | None, Query(alias="minCagr")] = None,
    max_drawdown: Annotated[float | None, Query(alias="maxDrawdown", ge=0, le=100)] = None,
    min_win_rate: Annotated[float | None, Query(alias="minWinRate", ge=0, le=100)] = None,
    min_trades: Annotated[int | None, Query(alias="minTrades", ge=0)] = None,
    min_profit_factor: Annotated[float | None, Query(alias="minProfitFactor", ge=0)] = None,
    profitable: bool | None = None,
    sort: BacktestListSort = "created",
    order: Literal["asc", "desc"] = "desc",
    limit: Limit = PAGE_LIMIT_DEFAULT,
    cursor: Cursor = None,
    offset: Annotated[int | None, Query(ge=0)] = None,
) -> JSONResponse:
    """Newest version of each backtest with its results, filtered and sorted (D60, D82 (6))."""
    filters = RunFilters(
        data_source=data_source,
        status=status,
        strategy_id=strategy_id,
        q=q,
        segment=segment,
        timeframe=timeframe,
        min_return=min_return,
        min_cagr=min_cagr,
        max_drawdown=max_drawdown,
        min_win_rate=min_win_rate,
        min_trades=min_trades,
        min_profit_factor=min_profit_factor,
        profitable=profitable,
    )
    items, next_cursor, total = filtered_runs(
        db, filters, sort, order == "desc", limit, cursor, offset
    )
    page = Page[BacktestRunListItem](items=items, next_cursor=next_cursor, total=total)
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
    run_id: str,
    _: CallerDep,
    db: Db,
    limit: Limit = PAGE_LIMIT_DEFAULT,
    cursor: Cursor = None,
    offset: Annotated[int | None, Query(ge=0)] = None,
) -> JSONResponse:
    _run(db, run_id)
    rows, next_cursor, total = oldest_first(
        db,
        Trade,
        Trade.entry_at,
        Trade.id,
        limit=limit,
        cursor=cursor,
        offset=offset,
        where=[Trade.run_id == run_id],
    )
    page = Page[TradeContract](
        items=[trade_contract(r) for r in rows], next_cursor=next_cursor, total=total
    )
    return JSONResponse(page.model_dump(mode="json"))


@router.get("/{run_id}/ledger")
def list_ledger(
    run_id: str,
    _: CallerDep,
    db: Db,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Limit = PAGE_LIMIT_DEFAULT,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
    symbol: Annotated[str | None, Query(min_length=1)] = None,
    all_days: Annotated[bool, Query(alias="allDays")] = False,
) -> JSONResponse:
    days = filter_days(load_ledger(db, run_id), from_, to, symbol, all_days)
    page = Page[LedgerDay](items=days[offset : offset + limit], next_cursor=None, total=len(days))
    return JSONResponse(page.model_dump(mode="json"))


@router.get("/{run_id}/timeline")
def list_timeline(
    run_id: str,
    _: CallerDep,
    db: Db,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Limit = PAGE_LIMIT_DEFAULT,
    from_: Annotated[date | None, Query(alias="from")] = None,
    to: date | None = None,
    symbol: Annotated[str | None, Query(min_length=1)] = None,
) -> JSONResponse:
    events = timeline(load_ledger(db, run_id), from_, to, symbol)
    page = Page[LedgerEvent](
        items=events[offset : offset + limit], next_cursor=None, total=len(events)
    )
    return JSONResponse(page.model_dump(mode="json"))


@router.get("/{run_id}/ledger/{day}")
def ledger_events(
    run_id: str,
    day: date,
    _: CallerDep,
    db: Db,
    symbol: Annotated[str | None, Query(min_length=1)] = None,
) -> JSONResponse:
    events = load_ledger(db, run_id).events.get(day, [])
    return JSONResponse(
        [
            event.model_dump(mode="json")
            for event in events
            if symbol is None or event.symbol == symbol
        ]
    )


@router.post("")
def queue_run(body: BacktestRunCreate, caller: CallerDep, db: Db) -> JSONResponse:
    check_source(strategy_spec(db, body.strategy_id, body.strategy_version), body.data_source)
    universe = body.universe.model_dump(mode="json")
    check_symbols(db, universe)
    check_benchmark(db, body.benchmark)
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
        data_source=body.data_source,
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
