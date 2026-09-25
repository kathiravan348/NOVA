from datetime import UTC, datetime, timedelta

from nova_backtest.bars import Bar
from nova_backtest.rules import SeriesCache, holds
from nova_contracts import RuleGroup


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
