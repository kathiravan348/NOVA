import { z } from "zod";
import {
  ExchangeSchema,
  IdSchema,
  SegmentSchema,
  TimeframeSchema,
  UtcDateTimeSchema,
} from "./common";
import { IndicatorNameSchema, checkIndicatorParams } from "./indicators";

export const PriceFieldSchema = z.enum(["open", "high", "low", "close", "volume"]);
export type PriceField = z.infer<typeof PriceFieldSchema>;

export const OffsetSchema = z.number().int().min(0).max(500);

export const OperandPriceSchema = z.strictObject({
  kind: z.literal("price"),
  field: PriceFieldSchema,
  /** Bars ago (D51); absent = 0. */
  offset: OffsetSchema.optional(),
});
export type OperandPrice = z.infer<typeof OperandPriceSchema>;

export const OperandIndicatorSchema = z.strictObject({
  kind: z.literal("indicator"),
  name: IndicatorNameSchema,
  params: z.record(z.string(), z.number()),
  /** Bars ago (D51); absent = 0. */
  offset: OffsetSchema.optional(),
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

/** Cost averaging (D53): buy again each `dropPercent` fall below the last buy, up to `maxAdds` times. */
export const AveragingSchema = z.strictObject({
  dropPercent: z.number().gt(0).lte(50),
  maxAdds: z.number().int().min(1).max(10),
});
export type Averaging = z.infer<typeof AveragingSchema>;

/** A strategy is rules only (D25); symbols are chosen per backtest run (`BacktestRun.universe`). */
const baseSpecFields = {
  segment: SegmentSchema,
  exchange: ExchangeSchema,
  timeframe: TimeframeSchema,
  sizing: SizingSchema,
  risk: RiskSchema,
  /** Absent = off (D53). */
  averaging: AveragingSchema.optional(),
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

/** Indicator settings problems in a visual spec (D51); write bodies refuse them, reads stay tolerant. */
export function specParamProblems(spec: StrategySpec): string[] {
  if (spec.mode !== "visual") return [];
  const operands = [spec.entry, spec.exit].flatMap((g) =>
    g.conditions.flatMap((c) => [c.left, c.right]),
  );
  return operands.flatMap((o) =>
    o.kind === "indicator" ? checkIndicatorParams(o.name, o.params) : [],
  );
}

const checkedSpec = (body: { spec: StrategySpec }, ctx: z.RefinementCtx) => {
  for (const message of specParamProblems(body.spec)) {
    ctx.addIssue({ code: "custom", message, path: ["spec"] });
  }
};

/** Body of `POST /strategies` (D43): creates version 1 of a `draft` strategy. */
export const StrategyCreateSchema = z
  .strictObject({
    name: z.string().min(1),
    description: z.string(),
    spec: StrategySpecSchema,
  })
  .superRefine(checkedSpec);
export type StrategyCreate = z.infer<typeof StrategyCreateSchema>;

/** Body of `POST /strategies/{id}/versions` (D43): versions are immutable; this adds latest + 1. */
export const StrategyVersionCreateSchema = z
  .strictObject({
    note: z.string(),
    spec: StrategySpecSchema,
  })
  .superRefine(checkedSpec);
export type StrategyVersionCreate = z.infer<typeof StrategyVersionCreateSchema>;

/** Body of `PATCH /strategies/{id}` (D43): at least one field. */
export const StrategyUpdateSchema = z
  .strictObject({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    status: StrategyStatusSchema.optional(),
  })
  .refine((u) => Object.keys(u).length > 0, { message: "Change at least one field" });
export type StrategyUpdate = z.infer<typeof StrategyUpdateSchema>;
