"""Intraday strategies (D84): a setup + a buying rule.

Mirrors `frontend/packages/contracts/src/intraday.ts`. The rules behind every field are in
`docs/INTRADAY-RESEARCH.md` §3 (setups) and §4 (buying rules). Every parameter is stored explicitly;
the defaults live in the screens and the Library.
"""

from typing import Annotated, Literal

from pydantic import Field

from nova_contracts.common import Contract

Bars = Annotated[int, Field(ge=1, le=20)]
AtrMultiple = Annotated[float, Field(gt=0, le=5)]
RMultiple = Annotated[float, Field(ge=0.5, le=10)]
RangeMinutes = Annotated[int, Field(ge=5, le=120)]
InitialPercent = Annotated[float, Field(ge=10, le=100)]
ConfirmBars = Annotated[int, Field(ge=1, le=5)]
ExpiryMinutes = Annotated[int, Field(ge=1, le=60)]
Scenario = Literal["base", "stress"]


class OpeningRangeRetest(Contract):
    kind: Literal["opening_range_retest"]
    range_minutes: RangeMinutes
    retest_bars: Bars
    buffer_atr: AtrMultiple
    target_r: RMultiple


class PrevDayHighRetest(Contract):
    kind: Literal["prev_day_high_retest"]
    retest_bars: Bars
    buffer_atr: AtrMultiple
    target_r: RMultiple


class InsideBarContinuation(Contract):
    kind: Literal["inside_bar_continuation"]
    expiry_bars: Bars
    buffer_atr: AtrMultiple
    target_r: RMultiple


class VwapTrendPullback(Contract):
    kind: Literal["vwap_trend_pullback"]
    proximity_atr: AtrMultiple
    # Strictly rising 5m VWAP values: at least two values to compare.
    rising_bars: Annotated[int, Field(ge=2, le=20)]
    expiry_bars: Bars
    target_r: RMultiple


class FailedBreakoutReclaim(Contract):
    kind: Literal["failed_breakout_reclaim"]
    reclaim_bars: Bars
    min_reward_r: RMultiple
    exit: Literal["vwap", "range_mid"]


IntradaySetup = Annotated[
    OpeningRangeRetest
    | PrevDayHighRetest
    | InsideBarContinuation
    | VwapTrendPullback
    | FailedBreakoutReclaim,
    Field(discriminator="kind"),
]


class BuySingle(Contract):
    kind: Literal["single"]


class BuyAverageOnRecovery(Contract):
    kind: Literal["average_on_recovery"]
    initial_percent: InitialPercent
    trigger_atr: AtrMultiple
    confirm_bars: ConfirmBars
    expiry_minutes: ExpiryMinutes


class BuyAddToWinner(Contract):
    kind: Literal["add_to_winner"]
    initial_percent: InitialPercent
    trigger_r: AtrMultiple
    confirm_bars: ConfirmBars
    expiry_minutes: ExpiryMinutes


BuyingRule = Annotated[
    BuySingle | BuyAverageOnRecovery | BuyAddToWinner, Field(discriminator="kind")
]


class StrategySpecIntraday(Contract):
    """D84: cash-equity intraday on NSE; 5m context and 1m confirmation bars, long only."""

    mode: Literal["intraday"]
    segment: Literal["equity_intraday"]
    exchange: Literal["NSE"]
    timeframe: Literal["1m"]
    setup: IntradaySetup
    buying: BuyingRule
