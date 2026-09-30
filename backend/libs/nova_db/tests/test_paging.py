from datetime import UTC, datetime, timedelta

import pytest
from nova_common import ApiException
from nova_db.models import AuditEntry
from nova_db.paging import newest_first, oldest_first
from sqlalchemy.orm import Session


@pytest.mark.parametrize("descending", [False, True])
def test_offset_and_cursor_share_order_and_filtered_total(
    session: Session, descending: bool
) -> None:
    for i in range(125):
        session.add(
            AuditEntry(
                id=f"aud_page_{i:03d}",
                at=datetime(2020, 1, 1, tzinfo=UTC) + timedelta(seconds=i),
                actor_name="Paging",
                action="backtest.run",
                summary=str(i),
            )
        )
    session.flush()
    helper = newest_first if descending else oldest_first
    filters = [AuditEntry.actor_name == "Paging"]
    rows, cursor, total = helper(
        session,
        AuditEntry,
        AuditEntry.at,
        AuditEntry.id,
        limit=50,
        cursor=None,
        offset=50,
        where=filters,
    )
    ids = [f"aud_page_{i:03d}" for i in range(125)]
    if descending:
        ids.reverse()
    assert [row.id for row in rows] == ids[50:100]
    assert total == 125 and cursor is not None
    rest, end, total = helper(
        session,
        AuditEntry,
        AuditEntry.at,
        AuditEntry.id,
        limit=50,
        cursor=cursor,
        where=filters,
    )
    assert [row.id for row in rest] == ids[100:]
    assert end is None and total == 125
    assert helper(
        session,
        AuditEntry,
        AuditEntry.at,
        AuditEntry.id,
        limit=50,
        cursor=None,
        offset=200,
        where=filters,
    ) == ([], None, 125)
    assert helper(
        session,
        AuditEntry,
        AuditEntry.at,
        AuditEntry.id,
        limit=50,
        cursor=None,
        offset=0,
        where=[AuditEntry.actor_name == "Nobody"],
    ) == ([], None, 0)
    with pytest.raises(ApiException):
        helper(session, AuditEntry, AuditEntry.at, AuditEntry.id, limit=50, cursor=cursor, offset=0)
