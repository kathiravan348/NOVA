import json

import pytest
from nova_contracts.live import LiveDaySummary, LiveSnapshotItem, LiveSubscribe, LiveTick
from nova_contracts.realtime import LiveTickMessage
from nova_testing.parity import Parity
from pydantic import ValidationError


@pytest.mark.parametrize(
    "name,model,schema",
    [
        ("liveTicks", LiveTick, "LiveTick"),
        ("liveSnapshot", LiveSnapshotItem, "LiveSnapshotItem"),
        ("liveDays", LiveDaySummary, "LiveDaySummary"),
    ],
)
def test_mocks_round_trip(
    parity: Parity,
    name: str,
    model: type[LiveTick | LiveSnapshotItem | LiveDaySummary],
    schema: str,
) -> None:
    for raw in parity.mock(name):
        dumped = model.model_validate_json(json.dumps(raw)).model_dump(mode="json")
        assert dumped == raw
        parity.assert_valid(dumped, schema)


def test_tick_envelope_and_subscription(parity: Parity) -> None:
    assert LiveSubscribe(type="live.subscribe", symbols=["M&M", "BAJAJ-AUTO"]).symbols == [
        "M&M",
        "BAJAJ-AUTO",
    ]
    tick = LiveTick.model_validate_json(json.dumps(parity.mock("liveTicks")[0]))
    parity.assert_valid(
        LiveTickMessage(type="live.tick", data=tick).model_dump(mode="json"), "RealtimeMessage"
    )
    parity.assert_valid(
        LiveSubscribe(type="live.subscribe", symbols=[]).model_dump(mode="json"), "LiveSubscribe"
    )


@pytest.mark.parametrize("symbols", [["INFY", "INFY"], ["../INFY"], [f"S{i}" for i in range(501)]])
def test_subscription_limits(symbols: list[str]) -> None:
    with pytest.raises(ValidationError):
        LiveSubscribe(type="live.subscribe", symbols=symbols)


def test_invalid_summary_and_non_integer_price(parity: Parity) -> None:
    day = parity.mock("liveDays")[0]
    with pytest.raises(ValidationError):
        LiveDaySummary.model_validate_json(json.dumps(day | {"missingSeconds": 1}))
    tick = parity.mock("liveTicks")[0]
    for change in ({"price": 1.5}, {"ticksThisSecond": 0}, {"extra": True}):
        with pytest.raises(ValidationError):
            LiveTick.model_validate_json(json.dumps(tick | change))
