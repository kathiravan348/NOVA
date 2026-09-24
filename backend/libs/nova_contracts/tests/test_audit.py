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

    dumped = Page[AuditEntry](items=entries[:2], next_cursor="abc").model_dump(mode="json")

    assert set(dumped) == {"items", "nextCursor"}
    assert dumped["items"] == parity.mock("auditEntries")[:2]


def test_page_rejects_empty_cursor() -> None:
    with pytest.raises(ValidationError):
        Page[AuditEntry](items=[], next_cursor="")
