import json

import pytest
from nova_contracts import (
    Contract,
    Strategy,
    StrategyCreate,
    StrategySpecVisual,
    StrategyStats,
    StrategyUpdate,
    StrategyVersionCreate,
)
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_every_mock_strategy_round_trips_and_matches_schema(parity: Parity) -> None:
    for raw in parity.mock("strategies"):
        dumped = Strategy.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, "Strategy")


def test_every_mock_stats_row_round_trips_and_matches_schema(parity: Parity) -> None:
    for raw in parity.mock("strategyStats"):
        dumped = StrategyStats.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, "StrategyStats")


def test_write_bodies_match_their_schemas(parity: Parity) -> None:
    spec = parity.mock("strategies")[0]["versions"][0]["spec"]
    bodies: list[tuple[type[Contract], dict[str, object], str]] = [
        (StrategyCreate, {"name": "New", "description": "", "spec": spec}, "StrategyCreate"),
        (StrategyVersionCreate, {"note": "v2", "spec": spec}, "StrategyVersionCreate"),
        (StrategyUpdate, {"status": "archived"}, "StrategyUpdate"),
    ]
    for model, body, schema in bodies:
        dumped = model.model_validate_json(json.dumps(body)).model_dump(
            mode="json", exclude_unset=True
        )
        assert dumped == body
        parity.assert_valid(dumped, schema)


@pytest.mark.parametrize(
    "change",
    [
        {"latestVersion": 9},
        {"status": "deleted"},
        {"versions": []},
    ],
)
def test_bad_strategy_is_rejected(parity: Parity, change: dict[str, object]) -> None:
    raw = parity.mock("strategies")[0] | change

    with pytest.raises(ValidationError):
        Strategy.model_validate_json(json.dumps(raw))


def test_empty_update_is_rejected() -> None:
    with pytest.raises(ValidationError):
        StrategyUpdate.model_validate_json("{}")


def test_unknown_operand_kind_is_rejected(parity: Parity) -> None:
    spec = parity.mock("strategies")[0]["versions"][0]["spec"]
    spec["entry"]["conditions"][0]["left"] = {"kind": "sentiment", "value": 1}

    with pytest.raises(ValidationError):
        StrategyVersionCreate.model_validate_json(json.dumps({"note": "", "spec": spec}))


def test_stats_rules_are_enforced(parity: Parity) -> None:
    completed = parity.mock("strategyStats")[0]

    for change in ({"runsTotal": 99}, {"bestNetPnl": None}, {"worstReturnPercent": 5}):
        with pytest.raises(ValidationError):
            StrategyStats.model_validate_json(json.dumps(completed | change))


def _visual(left: dict[str, object]) -> dict[str, object]:
    number = {"kind": "number", "value": 1}
    entry = {"left": left, "op": "gt", "right": number}
    exit_ = {"left": number, "op": "lt", "right": number}
    return {
        "mode": "visual",
        "segment": "equity_delivery",
        "exchange": "NSE",
        "timeframe": "1d",
        "sizing": {"type": "fixed_qty", "qty": 1},
        "risk": {"stopLossPercent": None, "targetPercent": None},
        "entry": {"combinator": "all", "conditions": [entry]},
        "exit": {"combinator": "all", "conditions": [exit_]},
    }


@pytest.mark.parametrize(
    "left",
    [
        {"kind": "indicator", "name": "macd", "params": {"period": 20}},
        {"kind": "indicator", "name": "rsi", "params": {"period": 2.5}},
    ],
)
def test_write_bodies_refuse_bad_params_but_reads_accept_them(left: dict[str, object]) -> None:
    spec = _visual(left)

    with pytest.raises(ValidationError):
        StrategyCreate.model_validate_json(
            json.dumps({"name": "S", "description": "", "spec": spec})
        )
    with pytest.raises(ValidationError):
        StrategyVersionCreate.model_validate_json(json.dumps({"note": "", "spec": spec}))
    StrategySpecVisual.model_validate_json(json.dumps(spec))


@pytest.mark.parametrize("offset", [0, 1, 500, None])
def test_offset_is_accepted_and_zero_is_not_written(offset: int | None) -> None:
    lefts: tuple[dict[str, object], ...] = (
        {"kind": "price", "field": "high"},
        {"kind": "indicator", "name": "sma", "params": {"period": 20}},
    )
    for left in lefts:
        raw = left if offset is None else left | {"offset": offset}
        spec = _visual(raw)

        dumped = StrategySpecVisual.model_validate_json(json.dumps(spec)).model_dump(mode="json")

        expected = left | {"offset": offset} if offset else left
        assert dumped["entry"]["conditions"][0]["left"] == expected


@pytest.mark.parametrize("offset", [-1, 501, 1.5])
def test_bad_offset_is_rejected(offset: float) -> None:
    lefts: tuple[dict[str, object], ...] = (
        {"kind": "price", "field": "high", "offset": offset},
        {"kind": "indicator", "name": "sma", "params": {}, "offset": offset},
    )
    for left in lefts:
        with pytest.raises(ValidationError):
            StrategySpecVisual.model_validate_json(json.dumps(_visual(left)))
