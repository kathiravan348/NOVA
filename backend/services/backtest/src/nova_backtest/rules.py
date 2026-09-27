"""Visual rules on whole arrays (D9, D45, D61): one stock's bars into `enter` and `exit` arrays."""

from collections.abc import Mapping, Sequence

import numpy as np
import numpy.typing as npt
from nova_contracts import Condition, Operand, RuleGroup
from nova_contracts.strategy import OperandIndicator, OperandNumber, OperandPrice

from nova_backtest.bars import Bar
from nova_backtest.columns import Columns
from nova_backtest.engine import EngineError
from nova_backtest.indicators import Floats, indicator_array, settings_for

Bools = npt.NDArray[np.bool_]


def _columns(bars: Columns | Sequence[Bar]) -> Columns:
    return bars if isinstance(bars, Columns) else Columns.from_bars(bars)


def shift(values: Floats, bars_ago: int) -> Floats:
    """The value `bars_ago` bars earlier at each index; NaN where there is none."""
    out = np.full(len(values), np.nan)
    if bars_ago < len(values):
        out[bars_ago:] = values[: len(values) - bars_ago]
    return out


class SeriesCache:
    """Operand values of one stock as float arrays, computed once per operand."""

    def __init__(self, bars: Columns | Sequence[Bar]) -> None:
        self._bars = _columns(bars)
        self._cache: dict[str, Floats] = {}

    def values(self, operand: Operand) -> Floats:
        """The operand's series: the cached plain series, shifted by `offset` (bars ago, D51),
        then times `multiplier` (D62)."""
        if not isinstance(operand, OperandPrice | OperandIndicator):
            return self._cached(operand)
        base = operand.model_copy(update={"offset": 0, "multiplier": None})
        series = self._cached(base)
        if operand.offset:
            series = shift(series, operand.offset)
        if operand.multiplier is not None:  # D62: after the offset
            series = series * operand.multiplier
        return series

    def _cached(self, operand: Operand) -> Floats:
        key = operand.model_dump_json()
        if key not in self._cache:
            self._cache[key] = self._compute(operand)
        return self._cache[key]

    def _compute(self, operand: Operand) -> Floats:
        bars = self._bars
        if isinstance(operand, OperandNumber):
            return np.full(len(bars), operand.value, dtype=np.float64)
        if isinstance(operand, OperandPrice):
            if operand.field == "volume":
                return bars.volume.astype(np.float64)
            column: npt.NDArray[np.int64] = getattr(bars, operand.field)
            return column / 100
        assert isinstance(operand, OperandIndicator)
        return indicator_array(operand.name, operand.params, bars)


def condition_holds(condition: Condition, cache: SeriesCache) -> Bools:
    """At every bar: does the condition hold at that bar's close? A missing value never holds."""
    a, b = cache.values(condition.left), cache.values(condition.right)
    known = ~np.isnan(a) & ~np.isnan(b)
    op = condition.op
    if op in ("crosses_above", "crosses_below"):
        before_a, before_b = shift(a, 1), shift(b, 1)
        known &= ~np.isnan(before_a) & ~np.isnan(before_b)
        with np.errstate(invalid="ignore"):
            if op == "crosses_above":
                return known & (before_a <= before_b) & (a > b)
            return known & (before_a >= before_b) & (a < b)
    with np.errstate(invalid="ignore"):
        if op == "gt":
            return known & (a > b)
        if op == "gte":
            return known & (a >= b)
        if op == "lt":
            return known & (a < b)
        if op == "lte":
            return known & (a <= b)
        return known & (np.abs(a - b) < 1e-9)  # eq


def group_holds(group: RuleGroup, cache: SeriesCache) -> Bools:
    results = [condition_holds(condition, cache) for condition in group.conditions]
    combined: Bools = (
        np.logical_and.reduce(results)
        if group.combinator == "all"
        else np.logical_or.reduce(results)
    )
    return combined


def holds(group: RuleGroup, cache: SeriesCache, i: int) -> bool:
    """One bar's answer (tests and callers that ask bar by bar)."""
    return bool(group_holds(group, cache)[i])


def check_group(group: RuleGroup) -> None:
    """Fails the run up front when a stored spec has settings the catalog no longer accepts."""
    for condition in group.conditions:
        for operand in (condition.left, condition.right):
            if isinstance(operand, OperandIndicator):
                try:
                    settings_for(operand.name, operand.params)
                except ValueError as exc:
                    raise EngineError(f"{exc}: open the strategy and save it again") from exc


def signals(bars: Columns, entry: RuleGroup, exit_: RuleGroup) -> tuple[Bools, Bools]:
    """One stock's `enter` and `exit` arrays (D61 pass 1); its indicator arrays are freed after."""
    cache = SeriesCache(bars)
    return group_holds(entry, cache), group_holds(exit_, cache)


class RuleSignals:
    """Entry/exit signals of a visual strategy, per symbol and bar index."""

    def __init__(
        self,
        bars: Mapping[str, Columns | Sequence[Bar]],
        entry: RuleGroup,
        exit_: RuleGroup,
    ) -> None:
        check_group(entry)
        check_group(exit_)
        self._arrays = {
            symbol: signals(_columns(series), entry, exit_) for symbol, series in bars.items()
        }

    @classmethod
    def from_arrays(cls, arrays: Mapping[str, tuple[Bools, Bools]]) -> "RuleSignals":
        signals_ = cls.__new__(cls)
        signals_._arrays = dict(arrays)
        return signals_

    def enter(self, symbol: str, i: int) -> bool:
        return bool(self._arrays[symbol][0][i])

    def exit(self, symbol: str, i: int) -> bool:
        return bool(self._arrays[symbol][1][i])
