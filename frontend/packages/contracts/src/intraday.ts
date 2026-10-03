import { z } from "zod";

// Intraday strategies (D84): a setup + a buying rule. Mirrors
// `backend/libs/nova_contracts/src/nova_contracts/intraday.py`. Rules: `docs/INTRADAY-RESEARCH.md` §3, §4.
// Every parameter is stored explicitly; the defaults below are for the screens and the Library.

const bars = z.number().int().min(1).max(20);
const atrMultiple = z.number().gt(0).lte(5);
const rMultiple = z.number().min(0.5).max(10);
const initialPercent = z.number().min(10).max(100);
const confirmBars = z.number().int().min(1).max(5);
const expiryMinutes = z.number().int().min(1).max(60);

export const ScenarioSchema = z.enum(["base", "stress"]);
export type Scenario = z.infer<typeof ScenarioSchema>;

export const OpeningRangeRetestSchema = z.strictObject({
  kind: z.literal("opening_range_retest"),
  rangeMinutes: z.number().int().min(5).max(120),
  retestBars: bars,
  bufferAtr: atrMultiple,
  targetR: rMultiple,
});

export const PrevDayHighRetestSchema = z.strictObject({
  kind: z.literal("prev_day_high_retest"),
  retestBars: bars,
  bufferAtr: atrMultiple,
  targetR: rMultiple,
});

export const InsideBarContinuationSchema = z.strictObject({
  kind: z.literal("inside_bar_continuation"),
  expiryBars: bars,
  bufferAtr: atrMultiple,
  targetR: rMultiple,
});

export const VwapTrendPullbackSchema = z.strictObject({
  kind: z.literal("vwap_trend_pullback"),
  proximityAtr: atrMultiple,
  /** Strictly rising 5m VWAP values: at least two values to compare. */
  risingBars: z.number().int().min(2).max(20),
  expiryBars: bars,
  targetR: rMultiple,
});

export const FailedBreakoutReclaimSchema = z.strictObject({
  kind: z.literal("failed_breakout_reclaim"),
  reclaimBars: bars,
  minRewardR: rMultiple,
  exit: z.enum(["vwap", "range_mid"]),
});

export const IntradaySetupSchema = z.discriminatedUnion("kind", [
  OpeningRangeRetestSchema,
  PrevDayHighRetestSchema,
  InsideBarContinuationSchema,
  VwapTrendPullbackSchema,
  FailedBreakoutReclaimSchema,
]);
export type IntradaySetup = z.infer<typeof IntradaySetupSchema>;
export type IntradaySetupKind = IntradaySetup["kind"];

export const BuySingleSchema = z.strictObject({ kind: z.literal("single") });

export const BuyAverageOnRecoverySchema = z.strictObject({
  kind: z.literal("average_on_recovery"),
  initialPercent,
  triggerAtr: atrMultiple,
  confirmBars,
  expiryMinutes,
});

export const BuyAddToWinnerSchema = z.strictObject({
  kind: z.literal("add_to_winner"),
  initialPercent,
  triggerR: atrMultiple,
  confirmBars,
  expiryMinutes,
});

export const BuyingRuleSchema = z.discriminatedUnion("kind", [
  BuySingleSchema,
  BuyAverageOnRecoverySchema,
  BuyAddToWinnerSchema,
]);
export type BuyingRule = z.infer<typeof BuyingRuleSchema>;
export type BuyingRuleKind = BuyingRule["kind"];

/** D84: cash-equity intraday on NSE; 5m context and 1m confirmation bars, long only. */
export const StrategySpecIntradaySchema = z.strictObject({
  mode: z.literal("intraday"),
  segment: z.literal("equity_intraday"),
  exchange: z.literal("NSE"),
  timeframe: z.literal("1m"),
  setup: IntradaySetupSchema,
  buying: BuyingRuleSchema,
});
export type StrategySpecIntraday = z.infer<typeof StrategySpecIntradaySchema>;

/** §3 defaults per setup kind. */
export const SETUP_DEFAULTS: { [K in IntradaySetupKind]: Extract<IntradaySetup, { kind: K }> } = {
  opening_range_retest: {
    kind: "opening_range_retest",
    rangeMinutes: 15,
    retestBars: 3,
    bufferAtr: 0.1,
    targetR: 2,
  },
  prev_day_high_retest: { kind: "prev_day_high_retest", retestBars: 3, bufferAtr: 0.1, targetR: 2 },
  inside_bar_continuation: {
    kind: "inside_bar_continuation",
    expiryBars: 3,
    bufferAtr: 0.1,
    targetR: 2,
  },
  vwap_trend_pullback: {
    kind: "vwap_trend_pullback",
    proximityAtr: 0.3,
    risingBars: 3,
    expiryBars: 3,
    targetR: 2,
  },
  failed_breakout_reclaim: {
    kind: "failed_breakout_reclaim",
    reclaimBars: 3,
    minRewardR: 2,
    exit: "vwap",
  },
};

/** §4 defaults per buying kind. */
export const BUYING_DEFAULTS: { [K in BuyingRuleKind]: Extract<BuyingRule, { kind: K }> } = {
  single: { kind: "single" },
  average_on_recovery: {
    kind: "average_on_recovery",
    initialPercent: 70,
    triggerAtr: 0.5,
    confirmBars: 1,
    expiryMinutes: 5,
  },
  add_to_winner: {
    kind: "add_to_winner",
    initialPercent: 70,
    triggerR: 1,
    confirmBars: 1,
    expiryMinutes: 5,
  },
};
