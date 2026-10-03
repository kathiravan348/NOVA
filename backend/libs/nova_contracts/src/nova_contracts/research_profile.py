"""Versioned intraday research settings: mirrors researchProfile.ts (D84)."""

from typing import Annotated, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Id, UtcDateTime
from nova_contracts.market_data import IndexName

Percent = Annotated[float, Field(gt=0, le=100)]
OptionalPercent = Annotated[float, Field(ge=0, le=100)]
AtrMultiple = Annotated[float, Field(gt=0, le=20)]
Milliseconds = Annotated[int, Field(ge=0, le=10000)]
Ticks = Annotated[int, Field(ge=0, le=20)]
IstTime = Annotated[
    str,
    Field(
        min_length=5,
        max_length=5,
        pattern=r"^(09:(1[5-9]|[2-5][0-9])|1[0-4]:[0-5][0-9]|15:[01][0-9]|15:2[0-9])$",
    ),
]


class ResearchAccount(Contract):
    initial_pool_percent: Percent
    add_pool_percent: OptionalPercent
    reserve_percent: OptionalPercent
    stock_cap_percent: Percent
    sector_cap_percent: Percent
    max_positions: Annotated[int, Field(ge=1, le=20)]
    risk_per_position_percent: Annotated[float, Field(gt=0, le=5)]
    open_risk_percent: Annotated[float, Field(gt=0, le=10)]
    daily_loss_percent: Annotated[float, Field(gt=0, le=10)]
    loss_streak_pause: Annotated[int, Field(ge=0, le=10)]
    max_new_positions_per_day: Annotated[int, Field(ge=1, le=50)]
    cooldown_minutes: Annotated[int, Field(ge=0)]


class ResearchExecution(Contract):
    delay_ms: Milliseconds
    stress_delay_ms: Milliseconds
    slippage_ticks: Ticks
    stress_slippage_ticks: Ticks
    max_quote_age_ms: Annotated[int, Field(ge=100, le=60000)]
    max_spread_bps: Annotated[float, Field(gt=0, le=200)]
    max_spread_to_stop_percent: Percent
    max_depth_percent: Percent
    min_fill_percent: Percent


class ResearchMarket(Contract):
    market_gate: bool
    market_index: IndexName
    index_range_minutes: Annotated[int, Field(gt=0)]
    decline_veto_percent: Percent


class ResearchSignal(Contract):
    min_relative_volume: Annotated[float, Field(gt=0, allow_inf_nan=False)]
    volume_baseline_sessions: Annotated[int, Field(ge=5, le=60)]
    min_stop_atr: AtrMultiple
    max_stop_atr: AtrMultiple
    atr_period: Annotated[int, Field(ge=2, le=50)]
    context_ema_period: Annotated[int, Field(ge=2, le=100)]
    range_span_atr: AtrMultiple


class ResearchTiming(Contract):
    earliest_entry: IstTime
    last_entry: IstTime
    square_off: IstTime
    max_hold_minutes: Annotated[int, Field(ge=1, le=375)]


class ResearchData(Contract):
    max_session_gap_seconds: Annotated[int, Field(ge=0, le=300)]


class ResearchSettings(Contract):
    account: ResearchAccount
    execution: ResearchExecution
    market: ResearchMarket
    signal: ResearchSignal
    timing: ResearchTiming
    data: ResearchData

    @model_validator(mode="after")
    def check_relationships(self) -> Self:
        account, execution, signal, timing = self.account, self.execution, self.signal, self.timing
        if account.initial_pool_percent + account.add_pool_percent + account.reserve_percent > 100:
            raise ValueError("Pools must sum to at most 100 percent")
        if account.open_risk_percent < account.risk_per_position_percent:
            raise ValueError("Open risk must be at least position risk")
        if execution.stress_delay_ms < execution.delay_ms:
            raise ValueError("Stress delay must be at least base delay")
        if execution.stress_slippage_ticks < execution.slippage_ticks:
            raise ValueError("Stress slippage must be at least base slippage")
        if signal.max_stop_atr <= signal.min_stop_atr:
            raise ValueError("Maximum stop ATR must exceed minimum stop ATR")
        if not timing.earliest_entry < timing.last_entry < timing.square_off:
            raise ValueError("Entry times must satisfy earliestEntry < lastEntry < squareOff")
        return self


def default_research_settings() -> ResearchSettings:
    """Independent defaults; parity tests compare them to the TS default fixture."""
    return ResearchSettings(
        account=ResearchAccount(
            initial_pool_percent=30,
            add_pool_percent=10,
            reserve_percent=60,
            stock_cap_percent=15,
            sector_cap_percent=20,
            max_positions=3,
            risk_per_position_percent=0.10,
            open_risk_percent=0.20,
            daily_loss_percent=0.30,
            loss_streak_pause=2,
            max_new_positions_per_day=5,
            cooldown_minutes=15,
        ),
        execution=ResearchExecution(
            delay_ms=250,
            stress_delay_ms=1000,
            slippage_ticks=1,
            stress_slippage_ticks=3,
            max_quote_age_ms=1500,
            max_spread_bps=8,
            max_spread_to_stop_percent=10,
            max_depth_percent=10,
            min_fill_percent=25,
        ),
        market=ResearchMarket(
            market_gate=True,
            market_index="NIFTY 50",
            index_range_minutes=15,
            decline_veto_percent=0.3,
        ),
        signal=ResearchSignal(
            min_relative_volume=1.2,
            volume_baseline_sessions=20,
            min_stop_atr=0.5,
            max_stop_atr=2.5,
            atr_period=14,
            context_ema_period=20,
            range_span_atr=3,
        ),
        timing=ResearchTiming(
            earliest_entry="09:30", last_entry="14:30", square_off="15:20", max_hold_minutes=60
        ),
        data=ResearchData(max_session_gap_seconds=30),
    )


class ResearchProfileVersion(Contract):
    version: Annotated[int, Field(ge=1)]
    note: str
    settings: ResearchSettings
    frozen: bool
    hash: Annotated[str, Field(min_length=64, max_length=64, pattern=r"^[a-fA-F0-9]{64}$")] | None
    created_at: UtcDateTime
    frozen_at: UtcDateTime | None

    @model_validator(mode="after")
    def check_freeze(self) -> Self:
        if self.frozen != (self.hash is not None):
            raise ValueError("Hash must be present exactly when frozen")
        if self.frozen != (self.frozen_at is not None):
            raise ValueError("Frozen time must be present exactly when frozen")
        return self


class ResearchProfile(Contract):
    id: Id
    name: Annotated[str, Field(min_length=1)]
    description: str
    versions: Annotated[list[ResearchProfileVersion], Field(min_length=1)]
    created_at: UtcDateTime
    updated_at: UtcDateTime

    @model_validator(mode="after")
    def check_versions(self) -> Self:
        if any(
            a.version <= b.version for a, b in zip(self.versions, self.versions[1:], strict=False)
        ):
            raise ValueError("Versions must be newest first and unique")
        return self


class ResearchProfileCreate(Contract):
    name: Annotated[str, Field(min_length=1)]
    description: str
    settings: ResearchSettings


class ResearchProfileVersionCreate(Contract):
    note: str
    settings: ResearchSettings


class ResearchProfileVersionUpdate(Contract):
    settings: ResearchSettings
