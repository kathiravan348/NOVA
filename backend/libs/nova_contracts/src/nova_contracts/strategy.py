"""Strategy contracts: mirror `frontend/packages/contracts/src/strategy.ts` (D9, D25, D43)."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Exchange, Id, Segment, Timeframe, UtcDateTime
from nova_contracts.indicators import IndicatorName, param_problems

PriceField = Literal["open", "high", "low", "close", "volume"]
ConditionOp = Literal["crosses_above", "crosses_below", "gt", "gte", "lt", "lte", "eq"]
StrategyStatus = Literal["draft", "active", "archived"]
NonEmpty = Annotated[str, Field(min_length=1)]
# Bars ago (D51): absent on the wire = 0, and 0 is never written back (old specs stay identical).
Offset = Annotated[int, Field(ge=0, le=500, exclude_if=lambda v: v == 0)]


class OperandPrice(Contract):
    kind: Literal["price"]
    field: PriceField
    offset: Offset = 0


class OperandIndicator(Contract):
    kind: Literal["indicator"]
    name: IndicatorName
    params: dict[str, float]
    offset: Offset = 0


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


class Risk(Contract):
    stop_loss_percent: Annotated[float, Field(gt=0)] | None
    target_percent: Annotated[float, Field(gt=0)] | None


class Averaging(Contract):
    """Cost averaging (D53): buy again each `drop_percent` fall below the last buy."""

    drop_percent: Annotated[float, Field(gt=0, le=50)]
    max_adds: Annotated[int, Field(ge=1, le=10)]


class _SpecBase(Contract):
    segment: Segment
    exchange: Exchange
    timeframe: Timeframe
    sizing: Sizing
    risk: Risk
    # Absent = off, and never written when off, so older specs stay identical (D53).
    averaging: Annotated[Averaging | None, Field(exclude_if=lambda v: v is None)] = None


class StrategySpecVisual(_SpecBase):
    mode: Literal["visual"]
    entry: RuleGroup
    exit: RuleGroup


class StrategySpecPython(_SpecBase):
    mode: Literal["python"]
    code: NonEmpty


StrategySpec = Annotated[StrategySpecVisual | StrategySpecPython, Field(discriminator="mode")]


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


def spec_param_problems(spec: StrategySpecVisual | StrategySpecPython) -> list[str]:
    """Indicator settings problems of a visual spec (D51): writes refuse them, reads do not."""
    if not isinstance(spec, StrategySpecVisual):
        return []
    operands = [o for g in (spec.entry, spec.exit) for c in g.conditions for o in (c.left, c.right)]
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
