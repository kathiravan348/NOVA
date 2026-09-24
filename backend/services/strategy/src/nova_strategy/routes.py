"""Strategies with immutable versions (D9, D25, D43) and the stats summary (D26)."""

from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import CallerDep
from nova_contracts import Strategy as StrategyContract
from nova_contracts import StrategyCreate, StrategyUpdate, StrategyVersionCreate
from nova_db import new_id
from nova_db.audit import record_audit
from nova_db.models import Strategy, StrategyVersion
from nova_db.web import Db
from sqlalchemy import select
from sqlalchemy.orm import Session

from nova_strategy.stats import strategy_stats

router = APIRouter(prefix="/strategies")


def to_contract(strategy: Strategy, versions: list[StrategyVersion]) -> StrategyContract:
    return StrategyContract.model_validate(
        {
            "id": strategy.id,
            "name": strategy.name,
            "description": strategy.description,
            "status": strategy.status,
            "latest_version": strategy.latest_version,
            "versions": [
                {
                    "version": v.version,
                    "created_at": v.created_at,
                    "note": v.note,
                    "spec": v.spec,
                }
                for v in sorted(versions, key=lambda v: v.version)
            ],
            "created_at": strategy.created_at,
            "updated_at": strategy.updated_at,
        }
    )


def _versions(db: Session, strategy_id: str) -> list[StrategyVersion]:
    return list(
        db.scalars(select(StrategyVersion).where(StrategyVersion.strategy_id == strategy_id))
    )


def _strategy(db: Session, strategy_id: str, *, lock: bool = False) -> Strategy:
    query = select(Strategy).where(Strategy.id == strategy_id)
    strategy = db.scalars(query.with_for_update() if lock else query).first()
    if strategy is None:
        raise ApiException(404, "not_found", f"Strategy {strategy_id} not found")
    return strategy


def _body(db: Session, strategy_id: str, status: int = 200) -> JSONResponse:
    strategy = _strategy(db, strategy_id)
    contract = to_contract(strategy, _versions(db, strategy_id))
    return JSONResponse(contract.model_dump(mode="json"), status_code=status)


@router.get("")
def list_strategies(_: CallerDep, db: Db) -> JSONResponse:
    strategies = db.scalars(select(Strategy).order_by(Strategy.created_at, Strategy.id)).all()
    grouped: dict[str, list[StrategyVersion]] = {}
    for version in db.scalars(select(StrategyVersion)):
        grouped.setdefault(version.strategy_id, []).append(version)
    body = [to_contract(s, grouped.get(s.id, [])).model_dump(mode="json") for s in strategies]
    return JSONResponse(body)


@router.get("/stats")
def list_stats(_: CallerDep, db: Db) -> JSONResponse:
    return JSONResponse([stats.model_dump(mode="json") for stats in strategy_stats(db)])


@router.get("/{strategy_id}")
def get_strategy(strategy_id: str, _: CallerDep, db: Db) -> JSONResponse:
    return _body(db, strategy_id)


@router.post("")
def create_strategy(body: StrategyCreate, caller: CallerDep, db: Db) -> JSONResponse:
    strategy = Strategy(
        id=new_id("stg"),
        name=body.name,
        description=body.description,
        status="draft",
        latest_version=1,
    )
    db.add(strategy)
    db.flush()
    db.add(
        StrategyVersion(
            strategy_id=strategy.id,
            version=1,
            note="First version",
            spec=body.spec.model_dump(mode="json"),
        )
    )
    record_audit(
        db,
        action="strategy.create",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"Created strategy {body.name}",
        target_type="strategy",
        target_id=strategy.id,
        ip=caller.ip,
    )
    db.commit()
    return _body(db, strategy.id, status=201)


@router.post("/{strategy_id}/versions")
def add_version(
    strategy_id: str, body: StrategyVersionCreate, caller: CallerDep, db: Db
) -> JSONResponse:
    strategy = _strategy(db, strategy_id, lock=True)  # one new version at a time
    strategy.latest_version += 1
    strategy.updated_at = datetime.now(UTC)
    db.add(
        StrategyVersion(
            strategy_id=strategy.id,
            version=strategy.latest_version,
            note=body.note,
            spec=body.spec.model_dump(mode="json"),
        )
    )
    record_audit(
        db,
        action="strategy.update",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"Saved version {strategy.latest_version} of {strategy.name}",
        target_type="strategy",
        target_id=strategy.id,
        ip=caller.ip,
    )
    db.commit()
    return _body(db, strategy.id, status=201)


@router.patch("/{strategy_id}")
def update_strategy(
    strategy_id: str, body: StrategyUpdate, caller: CallerDep, db: Db
) -> JSONResponse:
    strategy = _strategy(db, strategy_id, lock=True)
    changes: list[str] = []
    if body.name is not None:
        strategy.name = body.name
        changes.append("name")
    if body.description is not None:
        strategy.description = body.description
        changes.append("description")
    if body.status is not None:
        strategy.status = body.status
        changes.append(f"status {body.status}")
    if not changes:
        raise ApiException(400, "invalid_request", "Change at least one field")
    strategy.updated_at = datetime.now(UTC)
    record_audit(
        db,
        action="strategy.update",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"Updated {strategy.name}: {', '.join(changes)}",
        target_type="strategy",
        target_id=strategy.id,
        ip=caller.ip,
    )
    db.commit()
    return _body(db, strategy.id)
