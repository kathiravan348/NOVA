import json

import pytest
from nova_contracts import (
    BacktestRun,
    BacktestRunCreate,
    BacktestVersionCreate,
    Strategy,
    StrategySpecIntraday,
)
from nova_contracts.strategy import StrategySpec, spec_param_problems
from nova_testing.parity import Parity
from pydantic import TypeAdapter, ValidationError

SETUPS: list[dict[str, object]] = [
    {
        "kind": "opening_range_retest",
        "rangeMinutes": 15,
        "retestBars": 3,
        "bufferAtr": 0.1,
        "targetR": 2,
    },
    {"kind": "prev_day_high_retest", "retestBars": 3, "bufferAtr": 0.1, "targetR": 2},
    {"kind": "inside_bar_continuation", "expiryBars": 3, "bufferAtr": 0.1, "targetR": 2},
    {
        "kind": "vwap_trend_pullback",
        "proximityAtr": 0.3,
        "risingBars": 3,
        "expiryBars": 3,
        "targetR": 2,
    },
    {"kind": "failed_breakout_reclaim", "reclaimBars": 3, "minRewardR": 2, "exit": "vwap"},
]
BUYING: list[dict[str, object]] = [
    {"kind": "single"},
    {
        "kind": "average_on_recovery",
        "initialPercent": 70,
        "triggerAtr": 0.5,
        "confirmBars": 1,
        "expiryMinutes": 5,
    },
    {
        "kind": "add_to_winner",
        "initialPercent": 70,
        "triggerR": 1,
        "confirmBars": 1,
        "expiryMinutes": 5,
    },
]
SPEC: TypeAdapter[StrategySpec] = TypeAdapter(StrategySpec)


def _spec(setup: dict[str, object], buying: dict[str, object] | None = None) -> dict[str, object]:
    return {
        "mode": "intraday",
        "segment": "equity_intraday",
        "exchange": "NSE",
        "timeframe": "1m",
        "setup": setup,
        "buying": buying or {"kind": "single"},
    }


@pytest.mark.parametrize("setup", SETUPS)
@pytest.mark.parametrize("buying", BUYING)
def test_every_kind_with_defaults_is_valid(
    parity: Parity, setup: dict[str, object], buying: dict[str, object]
) -> None:
    raw = _spec(setup, buying)
    spec = SPEC.validate_python(raw)
    assert isinstance(spec, StrategySpecIntraday)
    assert spec.model_dump(mode="json") == json.loads(json.dumps(raw))
    assert spec_param_problems(spec) == []
    strategy = next(s for s in parity.mock("strategies") if s["id"] == "stg_006")
    strategy["versions"][0]["spec"] = raw
    parity.assert_valid(Strategy.model_validate(strategy).model_dump(mode="json"), "Strategy")


@pytest.mark.parametrize(
    "change",
    [
        {"setup": SETUPS[0] | {"rangeMinutes": 4}},
        {"setup": SETUPS[0] | {"retestBars": 21}},
        {"setup": SETUPS[0] | {"bufferAtr": 0}},
        {"setup": SETUPS[0] | {"targetR": 10.5}},
        {"setup": SETUPS[3] | {"risingBars": 1}},
        {"setup": SETUPS[4] | {"exit": "close"}},
        {"setup": SETUPS[1] | {"extra": 1}},
        {"buying": BUYING[1] | {"initialPercent": 9}},
        {"buying": BUYING[2] | {"triggerR": 0}},
        {"buying": BUYING[2] | {"confirmBars": 6}},
        {"buying": BUYING[1] | {"expiryMinutes": 61}},
        {"buying": {"kind": "single", "initialPercent": 70}},
        {"segment": "equity_delivery"},
        {"timeframe": "5m"},
        {"sizing": {"type": "fixed_qty", "qty": 1}},
    ],
)
def test_out_of_range_values_and_extra_keys_are_refused(change: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        SPEC.validate_python(_spec(SETUPS[0]) | change)


def test_runs_name_a_profile_version_and_scenario(parity: Parity) -> None:
    raw = next(r for r in parity.mock("backtestRuns") if r["id"] == "run_007")
    run = BacktestRun.model_validate_json(json.dumps(raw))
    assert (run.profile_id, run.profile_version, run.scenario) == ("research_001", 1, "base")
    body = {
        "strategyId": "stg_006",
        "strategyVersion": 1,
        "name": "Opening range retest · stress",
        "universe": {"type": "index", "index": "NIFTY 100"},
        "from": "2026-09-14",
        "to": "2026-09-18",
        "initialCapitalPaise": 100_000_000,
        "benchmark": None,
        "dataSource": "recorded",
        "profileId": "research_001",
        "profileVersion": 1,
        "scenario": "stress",
    }
    version = {k: v for k, v in body.items() if k != "strategyId"}
    for model, payload, schema in (
        (BacktestRunCreate, body, "BacktestRunCreate"),
        (BacktestVersionCreate, version, "BacktestVersionCreate"),
    ):
        dumped = model.model_validate_json(json.dumps(payload)).model_dump(mode="json")
        assert dumped == payload
        parity.assert_valid(dumped, schema)
        for missing in ("profileId", "profileVersion", "scenario"):
            with pytest.raises(ValidationError, match="go together"):
                model.model_validate({k: v for k, v in payload.items() if k != missing})
    with pytest.raises(ValidationError):
        BacktestRunCreate.model_validate(body | {"scenario": "worst"})
