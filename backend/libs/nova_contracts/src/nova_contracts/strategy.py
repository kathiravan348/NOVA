"""Strategy contracts: mirror `frontend/packages/contracts/src/strategy.ts` (D9, D25, D43)."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Exchange, Id, Segment, Timeframe, UtcDateTime
from nova_contracts.indicators import IndicatorName, param_problems
from nova_contracts.market_data import IndexName

PriceField = Literal["open", "high", "low", "close", "volume"]
ConditionOp = Literal["crosses_above", "crosses_below", "gt", "gte", "lt", "lte", "eq"]
StrategyStatus = Literal["draft", "active", "archived"]
NonEmpty = Annotated[str, Field(min_length=1)]
# Bars ago (D51): absent on the wire = 0, and 0 is never written back (old specs stay identical).
Offset = Annotated[int, Field(ge=0, le=500, exclude_if=lambda v: v == 0)]
# Multiplier (D62): absent on the wire = 1, never written when absent.
Multiplier = Annotated[Annotated[float, Field(gt=0)] | None, Field(exclude_if=lambda v: v is None)]


class OperandPrice(Contract):
    kind: Literal["price"]
    field: PriceField
    offset: Offset = 0
    multiplier: Multiplier = None


class OperandIndicator(Contract):
    kind: Literal["indicator"]
    name: IndicatorName
    params: dict[str, float]
    offset: Offset = 0
    multiplier: Multiplier = None


class OperandNumber(Contract):
    kind: Literal["number"]
    value: float


Operand = Annotated[OperandPrice | OperandIndicator | OperandNumber, Field(discriminator="kind")]


class Condition(Contract):
    left: Operand
    op: ConditionOp
    right: Operand


class RuleGroup(Contract):
    combinator: Literal["all", "any"]
    conditions: Annotated[list[Condition], Field(min_length=1)]


class SizingFixedQty(Contract):
    type: Literal["fixed_qty"]
    qty: Annotated[int, Field(gt=0)]


class SizingFixedAmount(Contract):
    type: Literal["fixed_amount"]
    amount_paise: Annotated[int, Field(gt=0)]


class SizingPercentEquity(Contract):
    type: Literal["percent_equity"]
    percent: Annotated[float, Field(gt=0, le=100)]


Sizing = Annotated[
    SizingFixedQty | SizingFixedAmount | SizingPercentEquity, Field(discriminator="type")
]


def _absent[T](value: T | None) -> bool:
    return value is None


class AtrStop(Contract):
    """D62: trails `multiplier` × ATR(`period`) below the highest close since the first buy."""

    period: Annotated[int, Field(ge=1)]
    multiplier: Annotated[float, Field(gt=0)]


class Risk(Contract):
    stop_loss_percent: Annotated[float, Field(gt=0)] | None
    target_percent: Annotated[float, Field(gt=0)] | None
    # D62, absent = off (never written when off, so older specs stay identical).
    trailing_stop_percent: Annotated[
        Annotated[float, Field(gt=0, le=50)] | None, Field(exclude_if=_absent)
    ] = None
    atr_stop: Annotated[AtrStop | None, Field(exclude_if=_absent)] = None
    max_hold_bars: Annotated[
        Annotated[int, Field(ge=1, le=5000)] | None, Field(exclude_if=_absent)
    ] = None


class Averaging(Contract):
    """Cost averaging (D53): buy again each `drop_percent` fall below the last buy."""

    drop_percent: Annotated[float, Field(gt=0, le=50)]
    max_adds: Annotated[int, Field(ge=1, le=10)]


# A price or indicator value: what ranks and scores are made of (never a plain number).
RankOperand = Annotated[OperandPrice | OperandIndicator, Field(discriminator="kind")]


class PortfolioRank(Contract):
    by: RankOperand
    order: Literal["desc", "asc"]


class Portfolio(Contract):
    """D62: at most `max_positions` holdings; waiting buys are taken best-ranked first."""

    max_positions: Annotated[int, Field(ge=1, le=100)]
    rank: Annotated[PortfolioRank | None, Field(exclude_if=_absent)] = None


class Regime(Contract):
    """D62 market filter: one condition on an index's own prices."""

    index: IndexName
    condition: Condition
    when_off: Literal["no_new_entries", "exit_all"]


class ScoreTerm(Contract):
    operand: RankOperand
    weight: float

    @model_validator(mode="after")
    def _nonzero(self) -> Self:
        if self.weight == 0:
            raise ValueError("Weight must not be 0")
        return self


class Rotation(Contract):
    """D62 rotation: each period hold the top `hold` by score; keep while ranked ≤ keep_within."""

    rebalance: Literal["weekly", "monthly", "quarterly"]
    hold: Annotated[int, Field(ge=1, le=50)]
    keep_within: Annotated[int, Field(ge=1, le=100)]
    score: Annotated[list[ScoreTerm], Field(min_length=1, max_length=3)]
    filter: Annotated[RuleGroup | None, Field(exclude_if=_absent)] = None

    @model_validator(mode="after")
    def _keep(self) -> Self:
        if self.keep_within < self.hold:
            raise ValueError("Keep while in top must be at least Hold")
        return self


class _SpecBase(Contract):
    segment: Segment
    exchange: Exchange
    timeframe: Timeframe
    sizing: Sizing
    risk: Risk
    # Absent = off, and never written when off, so older specs stay identical (D53, D62).
    averaging: Annotated[Averaging | None, Field(exclude_if=_absent)] = None
    portfolio: Annotated[Portfolio | None, Field(exclude_if=_absent)] = None
    regime: Annotated[Regime | None, Field(exclude_if=_absent)] = None


class StrategySpecVisual(_SpecBase):
    mode: Literal["visual"]
    entry: RuleGroup
    exit: RuleGroup


class StrategySpecPython(_SpecBase):
    mode: Literal["python"]
    code: NonEmpty


class StrategySpecRotation(Contract):
    """D62 (4): daily prices, delivery only, equal weight (no sizing)."""

    mode: Literal["rotation"]
    segment: Literal["equity_delivery"]
    exchange: Exchange
    timeframe: Literal["1d"]
    risk: Risk
    regime: Annotated[Regime | None, Field(exclude_if=_absent)] = None
    rotation: Rotation


StrategySpec = Annotated[
    StrategySpecVisual | StrategySpecPython | StrategySpecRotation, Field(discriminator="mode")
]
AnySpec = StrategySpecVisual | StrategySpecPython | StrategySpecRotation


class StrategyVersion(Contract):
    version: Annotated[int, Field(ge=1)]
    created_at: UtcDateTime
    note: str
    spec: StrategySpec


class Strategy(Contract):
    id: Id
    name: NonEmpty
    description: str
    status: StrategyStatus
    latest_version: Annotated[int, Field(ge=1)]
    versions: Annotated[list[StrategyVersion], Field(min_length=1)]
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @model_validator(mode="after")
    def _latest(self) -> Self:
        if self.latest_version != max(v.version for v in self.versions):
            raise ValueError("latestVersion must equal the maximum version in versions")
        return self


def _group_operands(group: RuleGroup | None) -> list[Operand]:
    return [o for c in (group.conditions if group else []) for o in (c.left, c.right)]


def spec_operands(spec: AnySpec) -> list[Operand]:
    """Every operand of a spec: rules, rank, market filter, rotation score and filter (D62)."""
    regime = [spec.regime.condition.left, spec.regime.condition.right] if spec.regime else []
    if isinstance(spec, StrategySpecRotation):
        score: list[Operand] = [t.operand for t in spec.rotation.score]
        return regime + score + _group_operands(spec.rotation.filter)
    rank: list[Operand] = [spec.portfolio.rank.by] if spec.portfolio and spec.portfolio.rank else []
    rules = (
        _group_operands(spec.entry) + _group_operands(spec.exit)
        if isinstance(spec, StrategySpecVisual)
        else []
    )
    return rules + rank + regime


def spec_param_problems(spec: AnySpec) -> list[str]:
    """Indicator setting problems anywhere in a spec (D51, D62): writes refuse, reads do not."""
    operands = spec_operands(spec)
    return [
        problem
        for o in operands
        if isinstance(o, OperandIndicator)
        for problem in param_problems(o.name, o.params)
    ]


class _CheckedSpec(Contract):
    spec: StrategySpec

    @model_validator(mode="after")
    def _params(self) -> Self:
        problems = spec_param_problems(self.spec)
        if problems:
            raise ValueError("; ".join(problems))
        return self


class StrategyCreate(_CheckedSpec):
    name: NonEmpty
    description: str


class StrategyVersionCreate(_CheckedSpec):
    note: str


class StrategyUpdate(Contract):
    name: NonEmpty | None = None
    description: str | None = None
    status: StrategyStatus | None = None

    @model_validator(mode="after")
    def _something(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Change at least one field")
        return self
