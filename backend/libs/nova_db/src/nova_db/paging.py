"""Keyset pages for growing lists (D32): newest first by `(time, id)`, with an opaque cursor."""

from collections.abc import Sequence
from datetime import datetime

from nova_common.paging import decode_cursor, encode_cursor
from sqlalchemy import ColumnElement, select, tuple_
from sqlalchemy.orm import InstrumentedAttribute, Session

from nova_db.models import Base


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
    """One page of `model` rows and the cursor for the next page (None on the last page)."""
    query = select(model).where(*where).order_by(at.desc(), row_id.desc())
    if cursor is not None:
        at_text, id_text = decode_cursor(cursor, 2)
        query = query.where(tuple_(at, row_id) < (datetime.fromisoformat(at_text), id_text))
    rows = list(db.scalars(query.limit(limit + 1)))
    if len(rows) <= limit:
        return rows, None
    rows = rows[:limit]
    last = rows[-1]
    return rows, encode_cursor([getattr(last, at.key).isoformat(), getattr(last, row_id.key)])
