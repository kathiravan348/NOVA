import json

import pytest
from nova_contracts import BacktestResult, BacktestRun, BacktestRunCreate, Trade
from nova_testing.parity import Parity
from pydantic import ValidationError


@pytest.mark.parametrize(
    ("mock", "model", "schema"),
    [
        ("backtestRuns", BacktestRun, "BacktestRun"),
        ("backtestResults", BacktestResult, "BacktestResult"),
        ("trades", Trade, "Trade"),
    ],
)
def test_every_mock_row_round_trips_and_matches_schema(
    parity: Parity, mock: str, model: type[BacktestRun | BacktestResult | Trade], schema: str
) -> None:
    for raw in parity.mock(mock):
        dumped = model.model_validate_json(json.dumps(raw)).model_dump(mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, schema)


def test_run_create_matches_its_schema(parity: Parity) -> None:
    run = parity.mock("backtestRuns")[0]
    body = {
        key: run[key]
        for key in (
            "strategyId",
            "strategyVersion",
            "name",
            "universe",
            "from",
            "to",
            "initialCapitalPaise",
            "benchmark",
        )
    }

    dumped = BacktestRunCreate.model_validate_json(json.dumps(body)).model_dump(mode="json")

    assert dumped == body
    parity.assert_valid(dumped, "BacktestRunCreate")


@pytest.mark.parametrize(
    ("mock", "model", "change"),
    [
        ("backtestRuns", BacktestRun, {"from": "2027-01-01"}),
        ("backtestRuns", BacktestRun, {"error": "boom"}),
        ("backtestRuns", BacktestRun, {"universe": {"type": "index", "index": "sensex"}}),
        ("trades", Trade, {"netPnlPaise": 1}),
        ("trades", Trade, {"exitPricePaise": None}),
    ],
)
def test_broken_rules_are_rejected(
    parity: Parity, mock: str, model: type[BacktestRun | Trade], change: dict[str, object]
) -> None:
    raw = parity.mock(mock)[0] | change

    with pytest.raises(ValidationError):
        model.model_validate_json(json.dumps(raw))


def test_result_rules_are_enforced(parity: Parity) -> None:
    raw = parity.mock("backtestResults")[0]
    bad_metrics = raw | {"metrics": raw["metrics"] | {"netPnlPaise": 0}}
    twice = raw | {"bySymbol": raw["bySymbol"] + raw["bySymbol"][:1]}

    for broken in (bad_metrics, twice):
        with pytest.raises(ValidationError):
            BacktestResult.model_validate_json(json.dumps(broken))
