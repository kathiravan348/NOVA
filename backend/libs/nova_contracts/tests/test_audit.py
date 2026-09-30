import json

import pytest
from nova_contracts import AuditEntry, Page
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_every_mock_entry_round_trips_and_matches_schema(parity: Parity) -> None:
    for raw in parity.mock("auditEntries"):
        dumped = AuditEntry.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, "AuditEntry")


def test_target_pair_is_enforced(parity: Parity) -> None:
    raw = parity.mock("auditEntries")[0] | {"targetType": "strategy", "targetId": None}

    with pytest.raises(ValidationError):
        AuditEntry.model_validate_json(json.dumps(raw))


def test_page_envelope_dumps_camel_case(parity: Parity) -> None:
    entries = [AuditEntry.model_validate_json(json.dumps(r)) for r in parity.mock("auditEntries")]

    dumped = Page[AuditEntry](items=entries[:2], next_cursor="abc", total=len(entries)).model_dump(
        mode="json"
    )

    assert set(dumped) == {"items", "nextCursor", "total"}
    assert dumped["items"] == parity.mock("auditEntries")[:2]
    assert dumped["total"] == len(entries)
    parity.assert_valid(dumped, "AuditPage")


def test_page_rejects_empty_cursor() -> None:
    with pytest.raises(ValidationError):
        Page[AuditEntry](items=[], next_cursor="", total=0)


@pytest.mark.parametrize("total", [-1, 1.5])
def test_page_rejects_invalid_total(total: int | float) -> None:
    with pytest.raises(ValidationError):
        Page[AuditEntry].model_validate({"items": [], "nextCursor": None, "total": total})
