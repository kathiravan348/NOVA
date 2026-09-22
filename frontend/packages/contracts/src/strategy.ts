import { z } from "zod";
import {
  ExchangeSchema,
  IdSchema,
  SegmentSchema,
  TimeframeSchema,
  UtcDateTimeSchema,
} from "./common";

export const PriceFieldSchema = z.enum(["open", "high", "low", "close", "volume"]);
export type PriceField = z.infer<typeof PriceFieldSchema>;

export const IndicatorNameSchema = z.enum([
  "sma",
  "ema",
  "rsi",
  "macd",
  "vwap",
  "atr",
  "bb_upper",
  "bb_lower",
]);
export type IndicatorName = z.infer<typeof IndicatorNameSchema>;

export const OperandPriceSchema = z.strictObject({
  kind: z.literal("price"),
  field: PriceFieldSchema,
});
export type OperandPrice = z.infer<typeof OperandPriceSchema>;

export const OperandIndicatorSchema = z.strictObject({
  kind: z.literal("indicator"),
  name: IndicatorNameSchema,
  params: z.record(z.string(), z.number()),
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

export const IndexNameSchema = z.enum(["NIFTY 50", "NIFTY BANK", "NIFTY NEXT 50"]);
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

export const RiskSchema = z.strictObject({
  stopLossPercent: z.number().positive().nullable(),
  targetPercent: z.number().positive().nullable(),
});
export type Risk = z.infer<typeof RiskSchema>;

const baseSpecFields = {
  segment: SegmentSchema,
  exchange: ExchangeSchema,
  timeframe: TimeframeSchema,
  universe: UniverseSchema,
  sizing: SizingSchema,
  risk: RiskSchema,
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

export const StrategySpecSchema = z.discriminatedUnion("mode", [
  StrategySpecVisualSchema,
  StrategySpecPythonSchema,
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
