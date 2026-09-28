import json

import pytest
from nova_contracts import (
    BacktestDeleteRequest,
    BacktestDeleteResult,
    BacktestResult,
    BacktestRun,
    BacktestRunCreate,
    BacktestVersion,
    BacktestVersionCreate,
    Trade,
    YearRow,
)
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


def test_runs_require_skipped_symbols(parity: Parity) -> None:
    raw = parity.mock("backtestRuns")[0].copy()
    raw.pop("skippedSymbols")
    with pytest.raises(ValidationError):
        BacktestRun.model_validate_json(json.dumps(raw))


@pytest.mark.parametrize(
    ("mock", "model", "change"),
    [
        ("backtestRuns", BacktestRun, {"from": "2027-01-01"}),
        ("backtestRuns", BacktestRun, {"error": "boom"}),
        ("backtestRuns", BacktestRun, {"universe": {"type": "index", "index": "sensex"}}),
        ("backtestRuns", BacktestRun, {"progress": None}),  # completed needs done at 100%
        ("backtestRuns", BacktestRun, {"version": 2}),  # v2 cannot be its own root (D60)
        ("backtestRuns", BacktestRun, {"skippedSymbols": ["bad symbol"]}),
        ("backtestRuns", BacktestRun, {"skippedSymbols": None}),
        (
            "backtestRuns",
            BacktestRun,
            {
                "progress": {
                    "stage": "simulating",
                    "percent": 40,
                    "symbolsDone": 3,
                    "symbolsTotal": 3,
                    "barsDone": 10,
                    "barsTotal": 20,
                    "tradesSoFar": 0,
                    "simulatedTo": None,
                }
            },
        ),
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


def test_version_bodies_match_their_schemas(parity: Parity) -> None:
    runs = {r["id"]: r for r in parity.mock("backtestRuns")}
    results = {r["runId"]: r for r in parity.mock("backtestResults")}
    old = runs["run_006"]
    version = {
        "runId": old["id"],
        "version": old["version"],
        "status": old["status"],
        "strategyVersion": old["strategyVersion"],
        "name": old["name"],
        "universe": old["universe"],
        "from": old["from"],
        "to": old["to"],
        "initialCapitalPaise": old["initialCapitalPaise"],
        "benchmark": old["benchmark"],
        "createdAt": old["createdAt"],
        "error": old["error"],
        "reportKept": old["reportKept"],
        "metrics": results["run_006"]["metrics"],
    }
    edit = {k: version[k] for k in ("strategyVersion", "name", "universe", "from", "to")} | {
        "initialCapitalPaise": old["initialCapitalPaise"],
        "benchmark": None,
    }
    for model, body, schema in (
        (BacktestVersion, version, "BacktestVersion"),
        (BacktestVersionCreate, edit, "BacktestVersionCreate"),
        (BacktestDeleteRequest, {"ids": ["run_001", "run_006"]}, "BacktestDeleteRequest"),
        (BacktestDeleteResult, {"deletedRuns": 2}, "BacktestDeleteResult"),
    ):
        dumped = model.model_validate_json(json.dumps(body)).model_dump(mode="json")
        assert dumped == body
        parity.assert_valid(dumped, schema)

    with pytest.raises(ValidationError):  # a completed version carries its metrics
        BacktestVersion.model_validate_json(json.dumps(version | {"metrics": None}))
    with pytest.raises(ValidationError):
        BacktestDeleteRequest.model_validate_json(json.dumps({"ids": []}))


def test_year_rows_check_their_period_and_drawdown() -> None:
    row = {
        "year": 1,
        "from": "2024-07-01",
        "to": "2025-06-30",
        "returnPercent": 3.0,
        "profitPaise": 300000,
        "maxDrawdownPercent": -2.0,
        "benchmarkPercent": None,
    }
    assert (
        YearRow.model_validate_json(json.dumps(row)).model_dump(mode="json", by_alias=True) == row
    )
    for change in ({"year": 0}, {"maxDrawdownPercent": 1.0}, {"from": "2025-07-01"}):
        with pytest.raises(ValidationError):
            YearRow.model_validate_json(json.dumps(row | change))
