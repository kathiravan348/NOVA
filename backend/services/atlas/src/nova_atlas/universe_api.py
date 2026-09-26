"""Stock list, indices and Kite sync over HTTP (D54, D56): `/market-data/universe`, `…/indices`."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Query, Response
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_common.internal import Caller, CallerDep
from nova_contracts import MarketIndex as MarketIndexContract
from nova_contracts import UniverseEntry, UniverseEntryWrite
from nova_db.audit import record_audit
from nova_db.models import DataJob, Instrument, MarketIndex
from nova_db.models import UniverseEntry as UniverseRow
from nova_db.web import Db
from sqlalchemy import select
from sqlalchemy.orm import Session

from nova_atlas.jobs import to_contract
from nova_atlas.sync_job import queue_instrument_sync
from nova_atlas.universe import EXCHANGE

router = APIRouter(prefix="/market-data")


def _view(row: UniverseRow, synced: bool) -> dict[str, object]:
    entry = UniverseEntry.model_validate(
        {
            "symbol": row.symbol,
            "name": row.name,
            "sector": row.sector,
            "indices": row.indices,
            "synced": synced,
            "newListing": row.new_listing,
        }
    )
    return entry.model_dump(mode="json")


def _synced(db: Session) -> set[str]:
    query = select(Instrument.symbol).where(
        Instrument.exchange == EXCHANGE, Instrument.instrument_token.is_not(None)
    )
    return set(db.scalars(query))


def _row(db: Session, symbol: str) -> UniverseRow:
    row = db.get(UniverseRow, (EXCHANGE, symbol))
    if row is None:
        raise ApiException(404, "not_found", f"{symbol} is not in the stock list")
    return row


def _audit(db: Session, caller: Caller, action: str, symbol: str, summary: str) -> None:
    record_audit(
        db,
        action=action,
        actor_id=caller.id,
        actor_name=caller.name,
        summary=summary,
        target_type="instrument",
        target_id=symbol,
        ip=caller.ip,
    )


def _fill(db: Session, row: UniverseRow, body: UniverseEntryWrite) -> None:
    indices = list(dict.fromkeys(body.indices))
    known = set(db.scalars(select(MarketIndex.name).where(MarketIndex.name.in_(indices))))
    unknown = [name for name in indices if name not in known]
    if unknown:
        raise ApiException(400, "invalid_request", f"Unknown index: {', '.join(unknown)}")
    row.name = body.name.strip()
    row.sector = body.sector.strip()
    row.indices = indices
    row.updated_at = datetime.now(UTC)


@router.get("/universe")
def list_universe(
    _: CallerDep,
    db: Db,
    q: Annotated[str | None, Query(max_length=40)] = None,
    index: Annotated[str | None, Query(max_length=40)] = None,
    sector: Annotated[str | None, Query(max_length=80)] = None,
    new: bool = False,
) -> JSONResponse:
    """The stock list by symbol, optionally filtered (D56). Small enough (~4,000) to send whole."""
    query = select(UniverseRow).where(UniverseRow.exchange == EXCHANGE)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.where(UniverseRow.symbol.ilike(like) | UniverseRow.name.ilike(like))
    if index:
        query = query.where(UniverseRow.indices.contains([index]))
    if sector:
        query = query.where(UniverseRow.sector == sector)
    if new:
        query = query.where(UniverseRow.new_listing)
    synced = _synced(db)
    rows = db.scalars(query.order_by(UniverseRow.symbol))
    return JSONResponse([_view(row, row.symbol in synced) for row in rows])


@router.post("/universe", status_code=201)
def add_entry(body: UniverseEntryWrite, caller: CallerDep, db: Db) -> JSONResponse:
    if db.get(UniverseRow, (EXCHANGE, body.symbol)) is not None:
        raise ApiException(400, "invalid_request", f"{body.symbol} is already in the stock list")
    row = UniverseRow(exchange=EXCHANGE, symbol=body.symbol)
    _fill(db, row, body)
    db.add(row)
    _audit(db, caller, "instrument.add", row.symbol, f"Added {row.symbol} ({row.name})")
    db.commit()
    return JSONResponse(_view(row, row.symbol in _synced(db)), status_code=201)


@router.put("/universe/{symbol}")
def update_entry(symbol: str, body: UniverseEntryWrite, caller: CallerDep, db: Db) -> JSONResponse:
    if body.symbol != symbol:
        raise ApiException(400, "invalid_request", "The symbol cannot be changed")
    row = _row(db, symbol)
    _fill(db, row, body)
    _audit(db, caller, "instrument.update", symbol, f"Updated {symbol} ({row.name})")
    db.commit()
    return JSONResponse(_view(row, symbol in _synced(db)))


@router.delete("/universe/{symbol}", status_code=204)
def remove_entry(symbol: str, caller: CallerDep, db: Db) -> Response:
    row = _row(db, symbol)
    busy = db.scalar(
        select(DataJob.id)
        .where(DataJob.status.in_(("queued", "running")), DataJob.symbols.contains([symbol]))
        .limit(1)
    )
    if busy is not None:
        raise ApiException(
            400, "invalid_request", f"{symbol} is used by data job {busy}; cancel it first"
        )
    db.delete(row)
    _audit(db, caller, "instrument.remove", symbol, f"Removed {symbol} from the stock list")
    db.commit()
    return Response(status_code=204)


@router.post("/universe/{symbol}/clear-new")
def clear_new(symbol: str, caller: CallerDep, db: Db) -> JSONResponse:
    """The Owner has seen this new listing (D56)."""
    row = _row(db, symbol)
    if row.new_listing:
        row.new_listing = False
        _audit(db, caller, "instrument.clear_new", symbol, f"Marked {symbol} as seen")
        db.commit()
    return JSONResponse(_view(row, symbol in _synced(db)))


@router.get("/indices")
def list_indices(_: CallerDep, db: Db) -> JSONResponse:
    """Every NSE index NOVA knows, biggest first (D56)."""
    rows = db.scalars(
        select(MarketIndex).order_by(MarketIndex.member_count.desc(), MarketIndex.name)
    )
    body = [
        MarketIndexContract.model_validate(
            {
                "name": row.name,
                "kiteSymbol": row.kite_symbol,
                "members": row.member_count,
                "updatedAt": row.updated_at,
            }
        ).model_dump(mode="json")
        for row in rows
    ]
    return JSONResponse(body)


@router.post("/instruments/sync", status_code=202)
def sync(caller: CallerDep, db: Db) -> JSONResponse:
    """Queues an `instrument_sync` job (D56); the worker runs it."""
    try:
        job = queue_instrument_sync(db, actor_id=caller.id, actor_name=caller.name, ip=caller.ip)
    except ValueError as exc:
        raise ApiException(400, "invalid_request", str(exc)) from exc
    db.commit()
    return JSONResponse(to_contract(job).model_dump(mode="json"), status_code=202)
