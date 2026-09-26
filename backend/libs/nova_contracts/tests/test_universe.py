import json

import pytest
from nova_contracts import UniverseEntry, UniverseEntryWrite
from nova_testing.parity import Parity
from pydantic import ValidationError

ENTRY = {"symbol": "M&M", "name": "Mahindra & Mahindra", "sector": "Automobile", "indices": []}


def test_bodies_match_their_schemas(parity: Parity) -> None:
    write = UniverseEntryWrite.model_validate_json(json.dumps(ENTRY)).model_dump(mode="json")
    listed = UniverseEntry.model_validate(ENTRY | {"synced": True, "newListing": True})
    listed_json = listed.model_dump(mode="json")

    assert write == ENTRY
    parity.assert_valid(write, "UniverseEntryWrite")
    assert listed_json["newListing"] is True
    parity.assert_valid(listed_json, "UniverseEntry")


@pytest.mark.parametrize(
    "change",
    [
        {"symbol": "infy"},
        {"symbol": "TOO-LONG-SYMBOL-NAME-X"},
        {"name": " "},
        {"sector": "x" * 81},
        {"indices": ["nifty it"]},
        {"indices": ["X" * 41]},
        {"synced": True},
    ],
)
def test_bad_write_body_is_rejected(change: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        UniverseEntryWrite.model_validate_json(json.dumps(ENTRY | change))
