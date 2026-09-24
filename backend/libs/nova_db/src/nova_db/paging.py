"""Keyset pages for growing lists (D32): ordered by `(time, id)`, with an opaque cursor."""

from collections.abc import Sequence
from datetime import datetime

from nova_common.paging import decode_cursor, encode_cursor
from sqlalchemy import ColumnElement, select, tuple_
from sqlalchemy.orm import InstrumentedAttribute, Session

from nova_db.models import Base


def _page[M: Base](
    db: Session,
    model: type[M],
    at: InstrumentedAttribute[datetime],
    row_id: InstrumentedAttribute[str],
    *,
    limit: int,
    cursor: str | None,
    where: Sequence[ColumnElement[bool]],
    descending: bool,
) -> tuple[list[M], str | None]:
    order = (at.desc(), row_id.desc()) if descending else (at.asc(), row_id.asc())
    query = select(model).where(*where).order_by(*order)
    if cursor is not None:
        at_text, id_text = decode_cursor(cursor, 2)
        key = (datetime.fromisoformat(at_text), id_text)
        query = query.where(tuple_(at, row_id) < key if descending else tuple_(at, row_id) > key)
    rows = list(db.scalars(query.limit(limit + 1)))
    if len(rows) <= limit:
        return rows, None
    rows = rows[:limit]
    last = rows[-1]
    return rows, encode_cursor([getattr(last, at.key).isoformat(), getattr(last, row_id.key)])


def newest_first[M: Base](
    db: Session,
    model: type[M],
    at: InstrumentedAttribute[datetime],
    row_id: InstrumentedAttribute[str],
    *,
    limit: int,
    cursor: str | None,
    where: Sequence[ColumnElement[bool]] = (),
) -> tuple[list[M], str | None]:
    """One page of `model` rows, newest first, and the next cursor (None on the last page)."""
    return _page(db, model, at, row_id, limit=limit, cursor=cursor, where=where, descending=True)


def oldest_first[M: Base](
    db: Session,
    model: type[M],
    at: InstrumentedAttribute[datetime],
    row_id: InstrumentedAttribute[str],
    *,
    limit: int,
    cursor: str | None,
    where: Sequence[ColumnElement[bool]] = (),
) -> tuple[list[M], str | None]:
    """One page of `model` rows, oldest first (trades in time order)."""
    return _page(db, model, at, row_id, limit=limit, cursor=cursor, where=where, descending=False)
