"""NOVA-109 (D61): bar columns, rules on arrays and indicator arrays match the per-bar engine."""

import random
from datetime import UTC, date, datetime, timedelta

import numpy as np
import pytest
from nova_backtest.bars import IST, Bar
from nova_backtest.columns import Columns, load
from nova_backtest.indicators import Series, indicator, indicator_array
from nova_backtest.rules import SeriesCache, group_holds
from nova_contracts import Condition, Operand, RuleGroup
from nova_contracts.indicators import INDICATORS
from nova_contracts.strategy import OperandIndicator, OperandNumber, OperandPrice
from nova_db.candles import read_bars
from nova_db.models import Candle
from sqlalchemy import Engine
from sqlalchemy.orm import Session

T0 = datetime(2026, 1, 5, 3, 45, tzinfo=UTC)


class ReferenceCache:
    """The per-bar rule evaluation before D61, kept as the oracle for the array rules."""

    def __init__(self, bars: list[Bar]) -> None:
        self._bars = bars
        self._cache: dict[str, Series] = {}

    def values(self, operand: Operand) -> Series:
        key = operand.model_dump_json()
        if key not in self._cache:
            self._cache[key] = self._values(operand)
        return self._cache[key]

    def _values(self, operand: Operand) -> Series:
        offset = operand.offset if isinstance(operand, OperandPrice | OperandIndicator) else 0
        base = operand.model_copy(update={"offset": 0}) if offset else operand
        if isinstance(base, OperandNumber):
            series: Series = [base.value] * len(self._bars)
        elif isinstance(base, OperandPrice):
            field = base.field
            series = [
                float(b.volume) if field == "volume" else getattr(b, field) / 100
                for b in self._bars
            ]
        else:
            assert isinstance(base, OperandIndicator)
            series = indicator(base.name, base.params, Columns.from_bars(self._bars))
        return [None] * min(offset, len(series)) + series[: max(len(series) - offset, 0)]


def _reference_condition(condition: Condition, cache: ReferenceCache, i: int) -> bool:
    left, right = cache.values(condition.left), cache.values(condition.right)
    a, b = left[i], right[i]
    if a is None or b is None:
        return False
    op = condition.op
    if op in ("crosses_above", "crosses_below"):
        if i == 0 or left[i - 1] is None or right[i - 1] is None:
            return False
        before_a, before_b = left[i - 1], right[i - 1]
        assert before_a is not None and before_b is not None
        if op == "crosses_above":
            return before_a <= before_b and a > b
        return before_a >= before_b and a < b
    return {
        "gt": a > b,
        "gte": a >= b,
        "lt": a < b,
        "lte": a <= b,
        "eq": abs(a - b) < 1e-9,
    }[op]


def reference_holds(group: RuleGroup, cache: ReferenceCache, i: int) -> bool:
    results = (_reference_condition(c, cache, i) for c in group.conditions)
    return all(results) if group.combinator == "all" else any(results)


def _random_bars(seed: int, count: int = 300, minutes: int = 1440) -> list[Bar]:
    """A random walk with flat stretches (equal closes) so crosses and `eq` get real edge cases."""
    rnd = random.Random(seed)
    price, bars = 10_000, []
    for i in range(count):
        step = 0 if (i // 20) % 3 == 0 else rnd.randint(-150, 150)
        price = max(500, price + step)
        spread = rnd.randint(0, 80)
        bars.append(
            Bar(
                T0 + timedelta(minutes=minutes * i),
                price,
                price + spread,
                price - spread,
                price,
                rnd.randint(0, 10_000),
            )
        )
    return bars


def test_columns_round_trip_and_ist_days() -> None:
    late = datetime(2026, 9, 1, 18, 25, tzinfo=UTC)  # 23:55 IST
    bars = [Bar(late, 1, 2, 1, 1, 5), Bar(late + timedelta(minutes=10), 1, 2, 1, 1, 6)]

    columns = Columns.from_bars(bars)

    assert columns.to_bars() == bars and len(columns) == 2
    days = [date(1970, 1, 1) + timedelta(days=int(d)) for d in columns.day]
    assert days == [b.ts.astimezone(IST).date() for b in bars]  # 1 Sep, then 2 Sep IST


OPS = ("crosses_above", "crosses_below", "gt", "gte", "lt", "lte", "eq")
LEFT = {"kind": "price", "field": "close"}
RIGHTS = [
    {"kind": "price", "field": "close", "offset": 1},
    {"kind": "price", "field": "high", "offset": 3},
    {"kind": "indicator", "name": "sma", "params": {"period": 5}},
    {"kind": "indicator", "name": "ema", "params": {"period": 8}, "offset": 2},
    {"kind": "indicator", "name": "rsi", "params": {"period": 3}},
    {"kind": "number", "value": 100.0},
]


@pytest.mark.parametrize("seed", range(30))
def test_array_rules_match_the_per_bar_reference(seed: int) -> None:
    bars = _random_bars(seed)
    cache, reference = SeriesCache(Columns.from_bars(bars)), ReferenceCache(bars)
    groups = [
        RuleGroup.model_validate(
            {
                "combinator": combinator,
                "conditions": [
                    {"left": LEFT, "op": op, "right": right},
                    {"left": RIGHTS[(i + 2) % len(RIGHTS)], "op": OPS[(i + 3) % 7], "right": LEFT},
                ],
            }
        )
        for combinator in ("all", "any")
        for op in OPS
        for i, right in enumerate(RIGHTS)
    ]
    for group in groups:
        arrays = group_holds(group, cache)
        expected = [reference_holds(group, reference, i) for i in range(len(bars))]
        assert arrays.tolist() == expected, group.model_dump_json()


@pytest.mark.parametrize("minutes", [1440, 15])
def test_every_indicator_array_equals_its_series(minutes: int) -> None:
    columns = Columns.from_bars(_random_bars(7, count=260, minutes=minutes))
    for definition in INDICATORS:
        series = indicator(definition.name, {}, columns)
        array = indicator_array(definition.name, {}, columns)
        expected = [np.nan if v is None else v for v in series]
        assert np.array_equal(array, np.array(expected), equal_nan=True), definition.name


def _candle(ts: datetime, timeframe: str) -> Candle:
    return Candle(
        exchange="NSE",
        symbol="INFY",
        timeframe=timeframe,
        ts=ts,
        open_paise=100,
        high_paise=120,
        low_paise=90,
        close_paise=110,
        volume=10,
    )


def test_load_reads_year_by_year_like_one_read(clean: Engine) -> None:
    first = datetime(2024, 1, 1, tzinfo=IST)
    days = [first + timedelta(days=n) for n in range(3 * 366)]
    with Session(clean) as db:
        db.add_all(_candle(d.astimezone(UTC), "1d") for d in days if d.weekday() < 5)
        # 1m bars around two new years, so rolled-up 15m buckets meet the yearly cuts.
        for year in (2025, 2026):
            start = datetime(year - 1, 12, 31, 15, 0, tzinfo=IST)
            db.add_all(
                _candle((start + timedelta(minutes=m)).astimezone(UTC), "1m") for m in range(40)
            )
        db.commit()
        span = (first.astimezone(UTC), (first + timedelta(days=3 * 366)).astimezone(UTC))
        for timeframe in ("1d", "15m"):
            once = read_bars(db, "NSE", "INFY", timeframe, *span)
            columns = load(db, "NSE", "INFY", timeframe, *span)
            assert [int(r.ts.timestamp()) for r in once] == columns.ts.tolist()
            assert [r.close_paise for r in once] == columns.close.tolist()
            assert len(columns) > 0
