from collections.abc import Mapping
from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
from nova_backtest.bars import Bar
from nova_backtest.engine import EngineError
from nova_backtest.rules import RuleSignals, SeriesCache, holds
from nova_contracts import RuleGroup
from nova_contracts.strategy import OperandPrice


def _cache(closes: list[int]) -> SeriesCache:
    t0 = datetime(2026, 9, 1, tzinfo=UTC)
    return SeriesCache(
        [
            Bar(t0 + timedelta(days=i), c * 100, c * 100, c * 100, c * 100, 1)
            for i, c in enumerate(closes)
        ]
    )


def _group(combinator: str, *conditions: tuple[str, object]) -> RuleGroup:
    return RuleGroup.model_validate(
        {
            "combinator": combinator,
            "conditions": [
                {
                    "left": {"kind": "price", "field": "close"},
                    "op": op,
                    "right": right,
                }
                for op, right in conditions
            ],
        }
    )


def test_crosses_above_needs_the_previous_bar_below() -> None:
    cache = _cache([100, 104, 106, 107])
    group = _group("all", ("crosses_above", {"kind": "number", "value": 105}))

    assert [holds(group, cache, i) for i in range(4)] == [False, False, True, False]


def test_indicator_without_enough_bars_never_holds() -> None:
    cache = _cache([100, 200])
    sma = {"kind": "indicator", "name": "sma", "params": {"period": 5}}

    assert not holds(_group("all", ("lt", sma)), cache, 1)


def test_all_and_any() -> None:
    cache = _cache([100])
    above = ("gt", {"kind": "number", "value": 50})
    below = ("lt", {"kind": "number", "value": 50})

    assert not holds(_group("all", above, below), cache, 0)
    assert holds(_group("any", above, below), cache, 0)
    assert holds(_group("all", ("eq", {"kind": "number", "value": 100})), cache, 0)


def _bars(highs: list[int], closes: list[int]) -> SeriesCache:
    t0 = datetime(2026, 9, 1, tzinfo=UTC)
    return SeriesCache(
        [
            Bar(t0 + timedelta(days=i), c * 100, h * 100, c * 100, c * 100, 1)
            for i, (h, c) in enumerate(zip(highs, closes, strict=True))
        ]
    )


def _one(left: Mapping[str, object], op: str, right: Mapping[str, object]) -> RuleGroup:
    return RuleGroup.model_validate(
        {"combinator": "all", "conditions": [{"left": left, "op": op, "right": right}]}
    )


def test_close_above_the_previous_high() -> None:
    cache = _bars([10, 12, 12, 14], [9, 11, 13, 13])
    group = _one(
        {"kind": "price", "field": "close"},
        "gt",
        {"kind": "price", "field": "high", "offset": 1},
    )

    # previous highs −, 10, 12, 12: bar 1 11 > 10, bar 2 13 > 12, bar 3 13 > 12; bar 0 has none
    assert [holds(group, cache, i) for i in range(4)] == [False, True, True, True]
    values = cache.values(_price(3))  # NaN where no bar is 3 bars back (D61 arrays)
    assert np.isnan(values[:3]).all() and values[3] == 9.0


def _price(offset: int) -> OperandPrice:
    return OperandPrice.model_validate({"kind": "price", "field": "close", "offset": offset})


def test_crosses_compare_the_shifted_series() -> None:
    cache = _bars([1] * 5, [100, 104, 106, 107, 107])
    group = _one(
        {"kind": "price", "field": "close", "offset": 1},
        "crosses_above",
        {"kind": "number", "value": 105},
    )

    # shifted closes: −, 100, 104, 106, 107 → crosses 105 at bar 3
    assert [holds(group, cache, i) for i in range(5)] == [False, False, False, True, False]


def test_bad_settings_fail_the_run_with_a_message() -> None:
    macd = {"kind": "indicator", "name": "macd", "params": {"period": 20}}
    group = _one(macd, "gt", {"kind": "number", "value": 0})

    with pytest.raises(EngineError, match="Unknown setting 'period' for MACD line: open the"):
        RuleSignals({}, group, group)


def _volumes(volumes: list[int]) -> SeriesCache:
    t0 = datetime(2026, 9, 1, tzinfo=UTC)
    return SeriesCache(
        [Bar(t0 + timedelta(days=i), 100, 100, 100, 100, v) for i, v in enumerate(volumes)]
    )


def test_volume_beats_one_and_a_half_times_its_average_d62() -> None:
    """`volume > 1.5 × volume_sma(3)`: the average includes the bar itself."""
    cache = _volumes([100, 100, 100, 250, 100, 400, 100])
    group = RuleGroup.model_validate(
        {
            "combinator": "all",
            "conditions": [
                {
                    "left": {"kind": "price", "field": "volume"},
                    "op": "gt",
                    "right": {
                        "kind": "indicator",
                        "name": "volume_sma",
                        "params": {"period": 3},
                        "multiplier": 1.5,
                    },
                }
            ],
        }
    )
    # Averages from bar 2: 100, 150, 150, 250, 200 → × 1.5 = 150, 225, 225, 375, 300.
    assert [holds(group, cache, i) for i in range(7)] == [
        False, False, False, True, False, True, False,
    ]  # fmt: skip


def test_offset_comes_before_the_multiplier_d62() -> None:
    cache = _cache([100, 110, 120, 130])
    operand = OperandPrice.model_validate(
        {"kind": "price", "field": "close", "offset": 1, "multiplier": 0.5}
    )

    values = cache.values(operand)

    assert np.isnan(values[0]) and values[1:].tolist() == [50.0, 55.0, 60.0]
    plain = cache.values(OperandPrice(kind="price", field="close"))
    assert plain.tolist() == [100.0, 110.0, 120.0, 130.0]  # the cached series is untouched
