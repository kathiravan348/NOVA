import { z } from "zod";
import {
  ConditionOpSchema,
  ExchangeSchema,
  IndexNameSchema,
  IndicatorNameSchema,
  PriceFieldSchema,
  RuleGroupCombinatorSchema,
  SegmentSchema,
  StrategySpecVisualSchema,
  TimeframeSchema,
  type Operand,
  type RuleGroup,
  type StrategySpecVisual,
} from "@nova/contracts";

/**
 * Form shape for the visual editor. Numeric inputs stay strings (what `<input>` gives) and are
 * checked here; `toSpec` turns a valid form into a contract `StrategySpecVisual`.
 */

const isNumber = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
const isPositive = (v: string) => isNumber(v) && Number(v) > 0;
const isPositiveInt = (v: string) => isPositive(v) && Number.isInteger(Number(v));

export const OperandFormSchema = z
  .object({
    kind: z.enum(["price", "indicator", "number"]),
    field: PriceFieldSchema,
    name: IndicatorNameSchema,
    period: z.string(),
    value: z.string(),
  })
  .superRefine((o, ctx) => {
    if (o.kind === "indicator" && o.name !== "vwap" && !isPositiveInt(o.period)) {
      ctx.addIssue({ code: "custom", path: ["period"], message: "Whole number above 0" });
    }
    if (o.kind === "number" && !isNumber(o.value)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a number" });
    }
  });
export type OperandForm = z.infer<typeof OperandFormSchema>;

export const RuleGroupFormSchema = z.object({
  combinator: RuleGroupCombinatorSchema,
  conditions: z
    .array(z.object({ left: OperandFormSchema, op: ConditionOpSchema, right: OperandFormSchema }))
    .min(1, "Add at least one condition"),
});
export type RuleGroupForm = z.infer<typeof RuleGroupFormSchema>;

export const EditorFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    description: z.string(),
    segment: SegmentSchema,
    exchange: ExchangeSchema,
    timeframe: TimeframeSchema,
    universeType: z.enum(["symbols", "index"]),
    symbols: z.string(),
    index: IndexNameSchema,
    sizingType: z.enum(["fixed_qty", "fixed_amount", "percent_equity"]),
    qty: z.string(),
    amountRupees: z.string(),
    percent: z.string(),
    stopLossPercent: z.string(),
    targetPercent: z.string(),
    entry: RuleGroupFormSchema,
    exit: RuleGroupFormSchema,
  })
  .superRefine((f, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (f.universeType === "symbols" && splitSymbols(f.symbols).length === 0) {
      issue("symbols", "Enter at least one symbol");
    }
    if (f.sizingType === "fixed_qty" && !isPositiveInt(f.qty)) {
      issue("qty", "Whole number above 0");
    }
    if (f.sizingType === "fixed_amount" && !isPositive(f.amountRupees)) {
      issue("amountRupees", "Amount above 0");
    }
    if (f.sizingType === "percent_equity" && !(isPositive(f.percent) && Number(f.percent) <= 100)) {
      issue("percent", "Between 0 and 100");
    }
    for (const key of ["stopLossPercent", "targetPercent"] as const) {
      if (f[key].trim() !== "" && !isPositive(f[key])) issue(key, "Leave empty or above 0");
    }
  });
export type EditorForm = z.infer<typeof EditorFormSchema>;

export function splitSymbols(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export const emptyOperand = (kind: OperandForm["kind"]): OperandForm => ({
  kind,
  field: "close",
  name: "sma",
  period: "20",
  value: "0",
});

export const emptyCondition = (): RuleGroupForm["conditions"][number] => ({
  left: emptyOperand("price"),
  op: "crosses_above",
  right: emptyOperand("indicator"),
});

export const emptyForm = (): EditorForm => ({
  name: "",
  description: "",
  segment: "equity_intraday",
  exchange: "NSE",
  timeframe: "5m",
  universeType: "symbols",
  symbols: "",
  index: "NIFTY 50",
  sizingType: "fixed_qty",
  qty: "",
  amountRupees: "",
  percent: "",
  stopLossPercent: "",
  targetPercent: "",
  entry: { combinator: "all", conditions: [emptyCondition()] },
  exit: { combinator: "any", conditions: [emptyCondition()] },
});

function operandFromSpec(o: Operand): OperandForm {
  const base = emptyOperand(o.kind);
  if (o.kind === "price") return { ...base, field: o.field };
  if (o.kind === "number") return { ...base, value: String(o.value) };
  return { ...base, name: o.name, period: o.params["period"] ? String(o.params["period"]) : "" };
}

function operandToSpec(o: OperandForm): Operand {
  if (o.kind === "price") return { kind: "price", field: o.field };
  if (o.kind === "number") return { kind: "number", value: Number(o.value) };
  return {
    kind: "indicator",
    name: o.name,
    params: o.name === "vwap" ? {} : { period: Number(o.period) },
  };
}

const groupFromSpec = (g: RuleGroup): RuleGroupForm => ({
  combinator: g.combinator,
  conditions: g.conditions.map((c) => ({
    left: operandFromSpec(c.left),
    op: c.op,
    right: operandFromSpec(c.right),
  })),
});

const groupToSpec = (g: RuleGroupForm): RuleGroup => ({
  combinator: g.combinator,
  conditions: g.conditions.map((c) => ({
    left: operandToSpec(c.left),
    op: c.op,
    right: operandToSpec(c.right),
  })),
});

export function fromSpec(name: string, description: string, spec: StrategySpecVisual): EditorForm {
  const form = emptyForm();
  return {
    ...form,
    name,
    description,
    segment: spec.segment,
    exchange: spec.exchange,
    timeframe: spec.timeframe,
    universeType: spec.universe.type,
    symbols: spec.universe.type === "symbols" ? spec.universe.symbols.join(", ") : "",
    index: spec.universe.type === "index" ? spec.universe.index : form.index,
    sizingType: spec.sizing.type,
    qty: spec.sizing.type === "fixed_qty" ? String(spec.sizing.qty) : "",
    amountRupees: spec.sizing.type === "fixed_amount" ? String(spec.sizing.amountPaise / 100) : "",
    percent: spec.sizing.type === "percent_equity" ? String(spec.sizing.percent) : "",
    stopLossPercent: spec.risk.stopLossPercent === null ? "" : String(spec.risk.stopLossPercent),
    targetPercent: spec.risk.targetPercent === null ? "" : String(spec.risk.targetPercent),
    entry: groupFromSpec(spec.entry),
    exit: groupFromSpec(spec.exit),
  };
}

const optionalPercent = (v: string) => (v.trim() === "" ? null : Number(v));

/** Valid form → contract spec, checked with `StrategySpecVisualSchema`. */
export function toSpec(form: EditorForm): StrategySpecVisual {
  const sizing: StrategySpecVisual["sizing"] =
    form.sizingType === "fixed_qty"
      ? { type: "fixed_qty", qty: Number(form.qty) }
      : form.sizingType === "fixed_amount"
        ? { type: "fixed_amount", amountPaise: Math.round(Number(form.amountRupees) * 100) }
        : { type: "percent_equity", percent: Number(form.percent) };
  return StrategySpecVisualSchema.parse({
    mode: "visual",
    segment: form.segment,
    exchange: form.exchange,
    timeframe: form.timeframe,
    universe:
      form.universeType === "index"
        ? { type: "index", index: form.index }
        : { type: "symbols", symbols: splitSymbols(form.symbols) },
    sizing,
    risk: {
      stopLossPercent: optionalPercent(form.stopLossPercent),
      targetPercent: optionalPercent(form.targetPercent),
    },
    entry: groupToSpec(form.entry),
    exit: groupToSpec(form.exit),
  });
}
