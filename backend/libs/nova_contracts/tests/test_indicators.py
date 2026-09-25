import json
from dataclasses import asdict
from typing import get_args

import pytest
from nova_contracts import INDICATORS, IndicatorName, check_params
from nova_contracts.indicators import param_problems
from nova_testing.parity import SCHEMA_DIR


def test_catalog_equals_the_typescript_export() -> None:
    exported = json.loads((SCHEMA_DIR / "indicators.json").read_text(encoding="utf-8"))

    assert [asdict(i) | {"params": [asdict(p) for p in i.params]} for i in INDICATORS] == exported
    assert list(get_args(IndicatorName)) == [i.name for i in INDICATORS]


def test_every_default_passes_its_own_check() -> None:
    for indicator in INDICATORS:
        assert param_problems(indicator.name, indicator.defaults()) == []
        assert param_problems(indicator.name, {}) == []


@pytest.mark.parametrize(
    ("name", "params", "message"),
    [
        ("macd", {"period": 20}, "Unknown setting 'period' for MACD line"),
        ("rsi", {"period": 2.5}, "RSI period must be a whole number of at least 1"),
        ("rsi", {"period": 0}, "RSI period must be a whole number of at least 1"),
        ("psar", {"step": 0}, "Parabolic SAR step must be above 0"),
        ("macd", {"fast": 30}, "MACD line fast must be less than slow"),
        ("nope", {}, "Unknown indicator 'nope'"),
    ],
)
def test_bad_params_are_reported(name: str, params: dict[str, float], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        check_params(name, params)
