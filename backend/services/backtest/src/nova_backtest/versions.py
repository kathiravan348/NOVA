"""Backtest versions and deletes (D60).

A backtest is a chain of runs sharing `root_id` (the first run's id), numbered by `version`.
Edit queues the next version; delete removes whole chains or one older version. Trades and
results go with their runs (FK cascade). When a version completes, older completed versions
keep only their metrics (`trim_older_versions`, called by the engine in its final commit).
"""

from typing import Any, cast

from nova_common import ApiException
from nova_common.internal import Caller
from nova_contracts import (
    SECONDS_TIMEFRAMES,
    BacktestDeleteResult,
    BacktestVersionCreate,
    Scenario,
)
from nova_contracts import BacktestVersion as VersionContract
from nova_db import new_id
from nova_db.audit import record_audit
from nova_db.models import (
    BacktestResult,
    BacktestRun,
    Instrument,
    MarketIndex,
    ResearchProfileVersion,
    StrategyVersion,
    Trade,
)
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


def check_source(spec: dict[str, Any], data_source: str) -> None:
    """400 for pairs the engine cannot run (D82). Any: a stored spec is JSON."""
    seconds = spec.get("timeframe") in SECONDS_TIMEFRAMES
    if data_source == "recorded":
        if spec.get("segment") != "equity_intraday":
            raise ApiException(400, "invalid_request", "Recorded data backtests are intraday only")
        if spec.get("regime") is not None:
            raise ApiException(
                400, "invalid_request", "Market filter is not available on recorded data yet"
            )
    elif seconds:
        raise ApiException(400, "invalid_request", "Seconds candles exist only in recorded data")


ProfileChoice = tuple[str | None, int | None, Scenario | None]


def check_profile(
    db: Session, spec: dict[str, Any], data_source: str, choice: ProfileChoice
) -> ProfileChoice:
    """D84: an intraday strategy runs on recorded data with a frozen research profile version and
    a scenario; other strategies take none. Answers the choice to store. Any: spec is JSON."""
    profile_id, version, scenario = choice
    if spec.get("mode") != "intraday":
        if profile_id is not None:
            raise ApiException(400, "invalid_request", "Only intraday runs take a research profile")
        return None, None, None
    if data_source != "recorded":
        raise ApiException(400, "invalid_request", "Intraday strategies run on recorded data")
    if profile_id is None or version is None or scenario is None:
        raise ApiException(
            400,
            "invalid_request",
            "An intraday run needs a research profile version and a scenario",
        )
    row = db.get(ResearchProfileVersion, (profile_id, version))
    if row is None:
        raise ApiException(
            400, "invalid_request", f"Research profile {profile_id} v{version} not found"
        )
    if not row.frozen:
        raise ApiException(
            400, "invalid_request", f"Freeze research profile v{version} before running it"
        )
    return profile_id, version, scenario


def strategy_spec(db: Session, strategy_id: str, version: int) -> dict[str, Any]:
    """The stored spec of one strategy version; 404 when it does not exist."""
    row = db.get(StrategyVersion, (strategy_id, version))
    if row is None:
        raise ApiException(404, "not_found", f"Strategy {strategy_id} version {version} not found")
    return row.spec


def check_benchmark(db: Session, name: str | None) -> None:
    """400 when the benchmark is not a stored index; null means no benchmark."""
    if name is not None and db.get(MarketIndex, name) is None:
        raise ApiException(400, "invalid_request", f"Unknown benchmark: {name}")


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
    data_source = body.data_source or newest.data_source
    spec = strategy_spec(db, newest.strategy_id, body.strategy_version)
    check_source(spec, data_source)
    given: ProfileChoice = (body.profile_id, body.profile_version, body.scenario)
    if body.profile_id is None:  # absent = the previous version's profile and scenario (D84)
        previous = cast(Scenario | None, newest.scenario)
        given = (newest.profile_id, newest.profile_version, previous)
    profile_id, profile_version, scenario = check_profile(db, spec, data_source, given)
    universe = body.universe.model_dump(mode="json")
    check_symbols(db, universe)
    check_benchmark(db, body.benchmark)
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
        data_source=data_source,
        profile_id=profile_id,
        profile_version=profile_version,
        scenario=scenario,
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
    """Older completed versions keep only their metrics and year table (no commit: the caller's
    transaction); their trades, equity curve and per-stock rows go."""
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
