"""Intraday setups (D84, `docs/INTRADAY-RESEARCH.md` §3): price patterns that emit a candidate
with its own stop and target at a completed 1m close.

A setup kind registers a factory: given the strategy's `setup` and one stock-day it returns a state
machine that is fed each completed 1m bar in order (`on_bar(i)`, `i` = the bar's index in the
day's 1m bars) and answers a `Candidate` or None. It may read only bars that have closed.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import Literal, Protocol

from nova_contracts import IntradaySetup

from nova_backtest.engine import EngineError
from nova_backtest.intraday.context import StockContext
from nova_backtest.intraday.tick_data import Bars, DayTicks

Family = Literal["trend", "range"]


@dataclass(frozen=True)
class StockDay:
    """What a setup may read about one stock on one day."""

    symbol: str
    day: date
    ticks: DayTicks
    bars1: Bars
    bars5: Bars
    context: StockContext | None = None  # NOVA-187: ATR, VWAP, previous session levels, …


@dataclass(frozen=True)
class Candidate:
    """A setup's proposal at the close of 1m bar `bar` (decision time `at_ms` = that close)."""

    at_ms: int
    symbol: str
    setup: str
    family: Family
    bar: int
    price: int  # the bar's close, the price sizing starts from
    stop: int
    # Exactly one target rule: `target_r` (fixed at the first fill: fill + R × (fill − stop)) or a
    # price `target` frozen now with `min_reward_r` room needed from the fill.
    target_r: float | None = None
    target: int | None = None
    min_reward_r: float | None = None

    def target_at(self, first_fill: int) -> int | None:
        """The target price once the first fill is known."""
        if self.target_r is not None:
            return round(first_fill + self.target_r * (first_fill - self.stop))
        return self.target


class StockSetup(Protocol):
    def on_bar(self, i: int) -> Candidate | None: ...


SetupFactory = Callable[[IntradaySetup, StockDay], StockSetup]
REGISTRY: dict[str, SetupFactory] = {}


def register(kind: str, factory: SetupFactory) -> None:
    REGISTRY[kind] = factory


def factory_for(setup: IntradaySetup) -> SetupFactory:
    """The factory of a setup kind; a kind without one fails the run plainly."""
    found = REGISTRY.get(setup.kind)
    if found is None:
        raise EngineError(f"The {setup.kind} setup arrives in NOVA-188/189")
    return found
