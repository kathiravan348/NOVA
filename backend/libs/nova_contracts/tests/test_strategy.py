import json
from typing import Any

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
from nova_contracts.strategy import spec_param_problems
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


def test_an_opening_range_needs_an_intraday_timeframe() -> None:
    """D62 (5): `or_high` / `or_low` have no value on daily bars, so writes refuse them."""
    or_low: dict[str, object] = {"kind": "indicator", "name": "or_low", "params": {"minutes": 30}}
    daily = _visual(or_low)

    assert spec_param_problems(StrategySpecVisual.model_validate(daily)) == [
        "Opening range needs an intraday timeframe"
    ]
    with pytest.raises(ValidationError, match="Opening range needs an intraday timeframe"):
        StrategyVersionCreate.model_validate_json(json.dumps({"note": "", "spec": daily}))
    intraday = daily | {"segment": "equity_intraday", "timeframe": "15m"}
    StrategyVersionCreate.model_validate_json(json.dumps({"note": "", "spec": intraday}))


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


@pytest.mark.parametrize(
    ("averaging", "ok"),
    [
        ({"dropPercent": 5, "maxAdds": 3}, True),
        ({"dropPercent": 50, "maxAdds": 10}, True),
        ({"dropPercent": 0, "maxAdds": 3}, False),
        ({"dropPercent": 51, "maxAdds": 3}, False),
        ({"dropPercent": 5, "maxAdds": 0}, False),
        ({"dropPercent": 5, "maxAdds": 11}, False),
        ({"dropPercent": 5, "maxAdds": 1.5}, False),
    ],
)
def test_averaging_is_checked_and_round_trips(averaging: dict[str, object], ok: bool) -> None:
    spec = _visual({"kind": "price", "field": "close"}) | {"averaging": averaging}

    if not ok:
        with pytest.raises(ValidationError):
            StrategySpecVisual.model_validate_json(json.dumps(spec))
        return
    dumped = StrategySpecVisual.model_validate_json(json.dumps(spec)).model_dump(mode="json")
    assert dumped["averaging"] == averaging


def test_absent_averaging_is_not_written() -> None:
    spec = _visual({"kind": "price", "field": "close"})

    dumped = StrategySpecVisual.model_validate_json(json.dumps(spec)).model_dump(mode="json")

    assert "averaging" not in dumped


def _mock_spec(parity: Parity, strategy_id: str) -> dict[str, Any]:
    strategy = next(s for s in parity.mock("strategies") if s["id"] == strategy_id)
    spec: dict[str, Any] = strategy["versions"][0]["spec"]
    return spec


def _create(spec: dict[str, Any]) -> StrategyCreate:
    body = {"name": "S", "description": "", "spec": spec}
    return StrategyCreate.model_validate_json(json.dumps(body))


def test_v2_mocks_round_trip_without_adding_fields(parity: Parity) -> None:
    """D62: new optional fields are never written when absent, and present ones survive."""
    for strategy_id in ("stg_004", "stg_005"):
        spec = _mock_spec(parity, strategy_id)
        dumped = _create(spec).model_dump(mode="json", exclude_unset=True)["spec"]
        assert dumped == spec
    old = parity.mock("strategies")[0]["versions"][0]["spec"]
    assert _create(old).model_dump(mode="json")["spec"] == old


@pytest.mark.parametrize(
    "change",
    [
        {"keepWithin": 5},
        {"score": []},
        {"score": [{"operand": {"kind": "price", "field": "close"}, "weight": 1}] * 4},
        {"score": [{"operand": {"kind": "price", "field": "close"}, "weight": 0}]},
        {"score": [{"operand": {"kind": "number", "value": 3}, "weight": 1}]},
        {
            "score": [
                {
                    "operand": {"kind": "indicator", "name": "sma", "params": {"period": 0}},
                    "weight": 1,
                }
            ]
        },
    ],
)
def test_bad_rotations_are_refused(parity: Parity, change: dict[str, Any]) -> None:
    spec = _mock_spec(parity, "stg_005")
    spec["rotation"] = spec["rotation"] | change

    with pytest.raises(ValidationError):
        _create(spec)


def test_bad_settings_in_rank_regime_and_multiplier_are_refused(parity: Parity) -> None:
    bad_sma = {"kind": "indicator", "name": "sma", "params": {"period": 0}}
    rank = _mock_spec(parity, "stg_004")
    rank["portfolio"]["rank"]["by"] = bad_sma
    regime = _mock_spec(parity, "stg_004")
    regime["regime"]["condition"]["right"] = bad_sma
    number_rank = _mock_spec(parity, "stg_004")
    number_rank["portfolio"]["rank"]["by"] = {"kind": "number", "value": 1}
    zero = _mock_spec(parity, "stg_004")
    zero["entry"]["conditions"][1]["right"]["multiplier"] = 0

    for spec in (rank, regime, number_rank, zero):
        with pytest.raises(ValidationError):
            _create(spec)
