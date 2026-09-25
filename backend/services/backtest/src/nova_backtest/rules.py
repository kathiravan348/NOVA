"""Evaluating a visual rule group on one symbol's bars (D9, D45)."""

from collections.abc import Mapping, Sequence

from nova_contracts import Condition, Operand, RuleGroup
from nova_contracts.strategy import OperandIndicator, OperandNumber, OperandPrice

from nova_backtest.bars import Bar
from nova_backtest.engine import EngineError
from nova_backtest.indicators import Series, indicator, settings_for


class SeriesCache:
    """Operand values per bar for one symbol, computed once per operand."""

    def __init__(self, bars: Sequence[Bar]) -> None:
        self._bars = bars
        self._cache: dict[str, Series] = {}

    def values(self, operand: Operand) -> Series:
        """The operand's series; `offset` (bars ago, D51) shifts the cached series without it."""
        offset = operand.offset if isinstance(operand, OperandPrice | OperandIndicator) else 0
        base = operand.model_copy(update={"offset": 0}) if offset else operand
        key = base.model_dump_json()
        if key not in self._cache:
            self._cache[key] = self._compute(base)
        series = self._cache[key]
        if not offset:
            return series
        return [None] * min(offset, len(series)) + series[: max(len(series) - offset, 0)]

    def _compute(self, operand: Operand) -> Series:
        if isinstance(operand, OperandNumber):
            return [operand.value] * len(self._bars)
        if isinstance(operand, OperandPrice):
            if operand.field == "volume":
                return [float(bar.volume) for bar in self._bars]
            return [getattr(bar, operand.field) / 100 for bar in self._bars]
        assert isinstance(operand, OperandIndicator)
        return indicator(operand.name, operand.params, self._bars)


def _holds(condition: Condition, cache: SeriesCache, i: int) -> bool:
    left, right = cache.values(condition.left), cache.values(condition.right)
    a, b = left[i], right[i]
    if a is None or b is None:
        return False
    op = condition.op
    if op in ("crosses_above", "crosses_below"):
        if i == 0:
            return False
        before_a, before_b = left[i - 1], right[i - 1]
        if before_a is None or before_b is None:
            return False
        if op == "crosses_above":
            return before_a <= before_b and a > b
        return before_a >= before_b and a < b
    if op == "gt":
        return a > b
    if op == "gte":
        return a >= b
    if op == "lt":
        return a < b
    if op == "lte":
        return a <= b
    return abs(a - b) < 1e-9  # eq


def holds(group: RuleGroup, cache: SeriesCache, i: int) -> bool:
    results = (_holds(condition, cache, i) for condition in group.conditions)
    return all(results) if group.combinator == "all" else any(results)


def _check(operand: OperandIndicator) -> None:
    """Fails the run up front when a stored spec has settings the catalog no longer accepts."""
    try:
        settings_for(operand.name, operand.params)
    except ValueError as exc:
        raise EngineError(f"{exc}: open the strategy and save it again") from exc


class RuleSignals:
    """Entry/exit signals of a visual strategy, per symbol and bar index."""

    def __init__(
        self, bars: Mapping[str, Sequence[Bar]], entry: RuleGroup, exit_: RuleGroup
    ) -> None:
        for group in (entry, exit_):
            for condition in group.conditions:
                for operand in (condition.left, condition.right):
                    if isinstance(operand, OperandIndicator):
                        _check(operand)
        self._caches = {symbol: SeriesCache(series) for symbol, series in bars.items()}
        self._entry, self._exit = entry, exit_

    def enter(self, symbol: str, i: int) -> bool:
        return holds(self._entry, self._caches[symbol], i)

    def exit(self, symbol: str, i: int) -> bool:
        return holds(self._exit, self._caches[symbol], i)
