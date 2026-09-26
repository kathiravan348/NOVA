import json

import pytest
from nova_contracts import Candle, Instrument, MarketIndex
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_every_mock_instrument_round_trips_and_matches_schema(parity: Parity) -> None:
    for raw in parity.mock("instruments"):
        dumped = Instrument.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, "Instrument")


def test_every_mock_candle_round_trips_and_matches_schema(parity: Parity) -> None:
    for series in parity.mock("candles").values():
        for raw in series:
            dumped = Candle.model_validate_json(json.dumps(raw)).model_dump(mode="json")

            assert dumped == raw
            parity.assert_valid(dumped, "Candle")


def test_intraday_candle_time_is_a_utc_datetime() -> None:
    raw = {
        "time": "2026-09-24T03:45:00Z",
        "openPaise": 100,
        "highPaise": 110,
        "lowPaise": 90,
        "closePaise": 105,
        "volume": 5,
    }

    assert Candle.model_validate_json(json.dumps(raw)).model_dump(mode="json") == raw


@pytest.mark.parametrize(
    "change",
    [
        {"lastClosePaise": 999_999_999},
        {"timeframes": ["1d", "1d"]},
        {"dataFrom": "2027-01-01"},
        {"indices": ["sensex"]},
    ],
)
def test_bad_instrument_is_rejected(parity: Parity, change: dict[str, object]) -> None:
    raw = parity.mock("instruments")[0] | change

    with pytest.raises(ValidationError):
        Instrument.model_validate_json(json.dumps(raw))


@pytest.mark.parametrize("change", [{"highPaise": 1}, {"lowPaise": 999_999_999}, {"volume": -1}])
def test_bad_candle_is_rejected(parity: Parity, change: dict[str, object]) -> None:
    raw = next(iter(parity.mock("candles").values()))[0] | change

    with pytest.raises(ValidationError):
        Candle.model_validate_json(json.dumps(raw))


def test_market_index_matches_its_schema(parity: Parity) -> None:
    index = MarketIndex.model_validate(
        {"name": "NIFTY IT", "kiteSymbol": "NIFTY IT", "members": 10, "updatedAt": None}
    )

    parity.assert_valid(index.model_dump(mode="json"), "MarketIndex")
