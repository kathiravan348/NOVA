"""Backtest versions and deletes (D60).

A backtest is a chain of runs sharing `root_id` (the first run's id), numbered by `version`.
Edit queues the next version; delete removes whole chains or one older version. Trades and
results go with their runs (FK cascade). When a version completes, older completed versions
keep only their metrics (`trim_older_versions`, called by the engine in its final commit).
"""

from nova_common import ApiException
from nova_common.internal import Caller
from nova_contracts import BacktestDeleteResult, BacktestVersionCreate
from nova_contracts import BacktestVersion as VersionContract
from nova_db import new_id
from nova_db.audit import record_audit
from nova_db.models import BacktestResult, BacktestRun, Instrument, Trade
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from nova_backtest.convert import version_contract

ACTIVE = ("queued", "running")


def _run(db: Session, run_id: str) -> BacktestRun:
    run = db.get(BacktestRun, run_id)
    if run is None:
        raise ApiException(404, "not_found", f"Backtest run {run_id} not found")
    return run


def chain(db: Session, root_id: str) -> list[BacktestRun]:
    """Every version of one backtest, newest first."""
    query = select(BacktestRun).where(BacktestRun.root_id == root_id)
    return list(db.scalars(query.order_by(BacktestRun.version.desc())))


def check_symbols(db: Session, universe: dict[str, object]) -> None:
    """400 when a chosen symbol is not a known NSE instrument (the engine checks indices)."""
    if universe["type"] != "symbols":
        return
    wanted = [str(s) for s in universe["symbols"]]  # type: ignore[attr-defined]
    known = set(
        db.scalars(
            select(Instrument.symbol).where(
                Instrument.exchange == "NSE", Instrument.symbol.in_(wanted)
            )
        )
    )
    unknown = [s for s in wanted if s not in known]
    if unknown:
        raise ApiException(400, "invalid_request", f"Unknown symbols: {', '.join(unknown)}")


def list_versions(db: Session, run_id: str) -> list[VersionContract]:
    runs = chain(db, _run(db, run_id).root_id)
    results = {
        r.run_id: r
        for r in db.scalars(
            select(BacktestResult).where(BacktestResult.run_id.in_([run.id for run in runs]))
        )
    }
    return [version_contract(run, results.get(run.id)) for run in runs]


def add_version(
    db: Session, run_id: str, body: BacktestVersionCreate, caller: Caller
) -> BacktestRun:
    """Queues the next version of the backtest `run_id` belongs to (Edit)."""
    runs = chain(db, _run(db, run_id).root_id)
    if any(r.status in ACTIVE for r in runs):
        raise ApiException(400, "invalid_request", "Wait for the running version to finish")
    newest = runs[0]
    universe = body.universe.model_dump(mode="json")
    check_symbols(db, universe)
    run = BacktestRun(
        id=new_id("run"),
        strategy_id=newest.strategy_id,
        strategy_version=body.strategy_version,
        name=body.name,
        universe=universe,
        status="queued",
        date_from=body.from_,
        date_to=body.to,
        initial_capital_paise=body.initial_capital_paise,
        benchmark=body.benchmark,
        root_id=newest.root_id,
        version=newest.version + 1,
    )
    db.add(run)
    record_audit(
        db,
        action="backtest.edit",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"Queued v{run.version} of backtest {body.name}",
        target_type="backtest",
        target_id=run.id,
        ip=caller.ip,
    )
    db.commit()
    return run


def _delete(db: Session, runs: list[BacktestRun], caller: Caller, summary: str) -> int:
    if any(r.status == "running" for r in runs):
        raise ApiException(400, "invalid_request", "A running backtest cannot be deleted")
    db.execute(delete(BacktestRun).where(BacktestRun.id.in_([r.id for r in runs])))
    record_audit(
        db,
        action="backtest.delete",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=summary,
        target_type="backtest",
        target_id=runs[0].id,
        ip=caller.ip,
    )
    db.commit()
    return len(runs)


def _versions_text(count: int) -> str:
    return "1 version" if count == 1 else f"{count} versions"


def delete_backtests(db: Session, run_ids: list[str], caller: Caller) -> BacktestDeleteResult:
    """Whole backtests: every version of each run's chain."""
    roots = list(dict.fromkeys(_run(db, run_id).root_id for run_id in run_ids))
    chains = [chain(db, root) for root in roots]
    runs = [run for runs in chains for run in runs]
    if len(chains) == 1:
        summary = f"Deleted backtest {chains[0][0].name} ({_versions_text(len(runs))})"
    else:
        summary = f"Deleted {len(chains)} backtests ({_versions_text(len(runs))})"
    return BacktestDeleteResult(deleted_runs=_delete(db, runs, caller, summary))


def delete_version(db: Session, run_id: str, caller: Caller) -> BacktestDeleteResult:
    """One older version; the newest version stays (delete the whole backtest instead)."""
    run = _run(db, run_id)
    if chain(db, run.root_id)[0].id == run.id:
        raise ApiException(400, "invalid_request", "Delete the whole backtest instead")
    summary = f"Deleted v{run.version} of backtest {run.name}"
    return BacktestDeleteResult(deleted_runs=_delete(db, [run], caller, summary))


def trim_older_versions(db: Session, run: BacktestRun) -> None:
    """Older completed versions keep only their metrics (no commit: the caller's transaction)."""
    older = [
        r.id
        for r in chain(db, run.root_id)
        if r.version < run.version and r.status == "completed" and r.report_kept
    ]
    if not older:
        return
    db.execute(delete(Trade).where(Trade.run_id.in_(older)))
    db.execute(
        update(BacktestResult)
        .where(BacktestResult.run_id.in_(older))
        .values(equity_curve=[], by_symbol=[])
    )
    db.execute(update(BacktestRun).where(BacktestRun.id.in_(older)).values(report_kept=False))
