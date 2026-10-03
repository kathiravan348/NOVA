import { z } from "zod";
import {
  ExchangeSchema,
  IdSchema,
  SegmentSchema,
  StrategyTimeframeSchema,
  UtcDateTimeSchema,
} from "./common";
import { IndicatorNameSchema } from "./indicators";

export const PriceFieldSchema = z.enum(["open", "high", "low", "close", "volume"]);
export type PriceField = z.infer<typeof PriceFieldSchema>;

export const OffsetSchema = z.number().int().min(0).max(500);

/** Multiplies the operand's value (D62), e.g. 1.5 × Volume SMA; absent = 1. */
export const MultiplierSchema = z.number().gt(0);

export const OperandPriceSchema = z.strictObject({
  kind: z.literal("price"),
  field: PriceFieldSchema,
  /** Bars ago (D51); absent = 0. */
  offset: OffsetSchema.optional(),
  multiplier: MultiplierSchema.optional(),
});
export type OperandPrice = z.infer<typeof OperandPriceSchema>;

export const OperandIndicatorSchema = z.strictObject({
  kind: z.literal("indicator"),
  name: IndicatorNameSchema,
  params: z.record(z.string(), z.number()),
  /** Bars ago (D51); absent = 0. */
  offset: OffsetSchema.optional(),
  multiplier: MultiplierSchema.optional(),
});
export type OperandIndicator = z.infer<typeof OperandIndicatorSchema>;

export const OperandNumberSchema = z.strictObject({
  kind: z.literal("number"),
  value: z.number(),
});
export type OperandNumber = z.infer<typeof OperandNumberSchema>;

export const OperandSchema = z.discriminatedUnion("kind", [
  OperandPriceSchema,
  OperandIndicatorSchema,
  OperandNumberSchema,
]);
export type Operand = z.infer<typeof OperandSchema>;

export const ConditionOpSchema = z.enum([
  "crosses_above",
  "crosses_below",
  "gt",
  "gte",
  "lt",
  "lte",
  "eq",
]);
export type ConditionOp = z.infer<typeof ConditionOpSchema>;

export const ConditionSchema = z.strictObject({
  left: OperandSchema,
  op: ConditionOpSchema,
  right: OperandSchema,
});
export type Condition = z.infer<typeof ConditionSchema>;

export const RuleGroupCombinatorSchema = z.enum(["all", "any"]);
export type RuleGroupCombinator = z.infer<typeof RuleGroupCombinatorSchema>;

export const RuleGroupSchema = z.strictObject({
  combinator: RuleGroupCombinatorSchema,
  conditions: z.array(ConditionSchema).min(1),
});
export type RuleGroup = z.infer<typeof RuleGroupSchema>;

/** Any row of `market_indices` (D56); the server checks the name exists on write. */
export const IndexNameSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[A-Z0-9 &-]+$/, "Capital letters, digits, spaces, & or -");
export type IndexName = z.infer<typeof IndexNameSchema>;

export const UniverseSymbolsSchema = z.strictObject({
  type: z.literal("symbols"),
  symbols: z.array(z.string().min(1)).min(1),
});
export type UniverseSymbols = z.infer<typeof UniverseSymbolsSchema>;

export const UniverseIndexSchema = z.strictObject({
  type: z.literal("index"),
  index: IndexNameSchema,
});
export type UniverseIndex = z.infer<typeof UniverseIndexSchema>;

export const UniverseSchema = z.discriminatedUnion("type", [
  UniverseSymbolsSchema,
  UniverseIndexSchema,
]);
export type Universe = z.infer<typeof UniverseSchema>;

export const SizingFixedQtySchema = z.strictObject({
  type: z.literal("fixed_qty"),
  qty: z.number().int().positive(),
});
export type SizingFixedQty = z.infer<typeof SizingFixedQtySchema>;

export const SizingFixedAmountSchema = z.strictObject({
  type: z.literal("fixed_amount"),
  amountPaise: z.number().int().positive(),
});
export type SizingFixedAmount = z.infer<typeof SizingFixedAmountSchema>;

export const SizingPercentEquitySchema = z.strictObject({
  type: z.literal("percent_equity"),
  percent: z.number().gt(0).lte(100),
});
export type SizingPercentEquity = z.infer<typeof SizingPercentEquitySchema>;

export const SizingSchema = z.discriminatedUnion("type", [
  SizingFixedQtySchema,
  SizingFixedAmountSchema,
  SizingPercentEquitySchema,
]);
export type Sizing = z.infer<typeof SizingSchema>;

/** ATR stop (D62): trails `multiplier` × ATR(`period`) below the highest close since the first buy. */
export const AtrStopSchema = z.strictObject({
  period: z.number().int().min(1),
  multiplier: z.number().gt(0),
});
export type AtrStop = z.infer<typeof AtrStopSchema>;

export const RiskSchema = z.strictObject({
  stopLossPercent: z.number().positive().nullable(),
  targetPercent: z.number().positive().nullable(),
  /** D62, absent = off: sell this % below the highest close since the first buy. */
  trailingStopPercent: z.number().gt(0).lte(50).optional(),
  atrStop: AtrStopSchema.optional(),
  /** D62, absent = off: sell at the next open once held this many bars. */
  maxHoldBars: z.number().int().min(1).max(5000).optional(),
});
export type Risk = z.infer<typeof RiskSchema>;

/** Cost averaging (D53): buy again each `dropPercent` fall below the last buy, up to `maxAdds` times. */
export const AveragingSchema = z.strictObject({
  dropPercent: z.number().gt(0).lte(50),
  maxAdds: z.number().int().min(1).max(10),
});
export type Averaging = z.infer<typeof AveragingSchema>;

/** A price or indicator value: what ranks and scores are made of (never a plain number). */
export const RankOperandSchema = z.discriminatedUnion("kind", [
  OperandPriceSchema,
  OperandIndicatorSchema,
]);
export type RankOperand = z.infer<typeof RankOperandSchema>;

/** D62: at most `maxPositions` holdings; buys waiting at the same time are taken best-ranked first. */
export const PortfolioSchema = z.strictObject({
  maxPositions: z.number().int().min(1).max(100),
  rank: z.strictObject({ by: RankOperandSchema, order: z.enum(["desc", "asc"]) }).optional(),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

/** D62 market filter: one condition on an index's own prices; what happens while it fails. */
export const RegimeSchema = z.strictObject({
  index: IndexNameSchema,
  condition: ConditionSchema,
  whenOff: z.enum(["no_new_entries", "exit_all"]),
});
export type Regime = z.infer<typeof RegimeSchema>;

export const ScoreTermSchema = z.strictObject({
  operand: RankOperandSchema,
  weight: z.number().refine((w) => w !== 0, { message: "Weight must not be 0" }),
});
export type ScoreTerm = z.infer<typeof ScoreTermSchema>;

/** D62 rotation: each period hold the top `hold` stocks by score; keep one while ranked ≤ `keepWithin`. */
export const RotationSchema = z
  .strictObject({
    rebalance: z.enum(["weekly", "monthly", "quarterly"]),
    hold: z.number().int().min(1).max(50),
    keepWithin: z.number().int().min(1).max(100),
    score: z.array(ScoreTermSchema).min(1).max(3),
    filter: RuleGroupSchema.optional(),
  })
  .refine((r) => r.keepWithin >= r.hold, {
    message: "Keep while in top must be at least Hold",
    path: ["keepWithin"],
  });
export type Rotation = z.infer<typeof RotationSchema>;

/** A strategy is rules only (D25); symbols are chosen per backtest run (`BacktestRun.universe`). */
const baseSpecFields = {
  segment: SegmentSchema,
  exchange: ExchangeSchema,
  timeframe: StrategyTimeframeSchema,
  sizing: SizingSchema,
  risk: RiskSchema,
  /** Absent = off (D53). */
  averaging: AveragingSchema.optional(),
  /** Absent = no limit, buys in symbol order (D62). */
  portfolio: PortfolioSchema.optional(),
  /** Absent = no market filter (D62). */
  regime: RegimeSchema.optional(),
};

export const StrategySpecVisualSchema = z.strictObject({
  mode: z.literal("visual"),
  ...baseSpecFields,
  entry: RuleGroupSchema,
  exit: RuleGroupSchema,
});
export type StrategySpecVisual = z.infer<typeof StrategySpecVisualSchema>;

export const StrategySpecPythonSchema = z.strictObject({
  mode: z.literal("python"),
  ...baseSpecFields,
  code: z.string().min(1),
});
export type StrategySpecPython = z.infer<typeof StrategySpecPythonSchema>;

/** D62 (4): rotation runs on daily prices, delivery only; equal weight, so no sizing. */
export const StrategySpecRotationSchema = z.strictObject({
  mode: z.literal("rotation"),
  segment: z.literal("equity_delivery"),
  exchange: ExchangeSchema,
  timeframe: z.literal("1d"),
  risk: RiskSchema,
  regime: RegimeSchema.optional(),
  rotation: RotationSchema,
});
export type StrategySpecRotation = z.infer<typeof StrategySpecRotationSchema>;

export const StrategySpecSchema = z.discriminatedUnion("mode", [
  StrategySpecVisualSchema,
  StrategySpecPythonSchema,
  StrategySpecRotationSchema,
]);
export type StrategySpec = z.infer<typeof StrategySpecSchema>;

export const StrategyVersionSchema = z.strictObject({
  version: z.number().int().min(1),
  createdAt: UtcDateTimeSchema,
  note: z.string(),
  spec: StrategySpecSchema,
});
export type StrategyVersion = z.infer<typeof StrategyVersionSchema>;

export const StrategyStatusSchema = z.enum(["draft", "active", "archived"]);
export type StrategyStatus = z.infer<typeof StrategyStatusSchema>;

export const StrategySchema = z
  .strictObject({
    id: IdSchema,
    name: z.string().min(1),
    description: z.string(),
    status: StrategyStatusSchema,
    latestVersion: z.number().int().min(1),
    versions: z.array(StrategyVersionSchema).min(1),
    createdAt: UtcDateTimeSchema,
    updatedAt: UtcDateTimeSchema,
  })
  .refine(
    (data) => {
      const maxVersion = Math.max(...data.versions.map((v) => v.version));
      return data.latestVersion === maxVersion;
    },
    {
      message: "latestVersion must equal the maximum version in versions array",
      path: ["latestVersion"],
    },
  );
export type Strategy = z.infer<typeof StrategySchema>;
