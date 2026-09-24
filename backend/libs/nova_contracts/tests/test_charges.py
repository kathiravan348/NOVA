import json

import pytest
from nova_contracts import Charges
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_every_mock_trade_charge_round_trips(parity: Parity) -> None:
    for trade in parity.mock("trades"):
        raw = trade["charges"]

        dumped = Charges.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw


def test_total_must_be_the_sum(parity: Parity) -> None:
    raw = parity.mock("trades")[0]["charges"]
    raw = raw | {"totalPaise": raw["totalPaise"] + 1}

    with pytest.raises(ValidationError):
        Charges.model_validate_json(json.dumps(raw))
