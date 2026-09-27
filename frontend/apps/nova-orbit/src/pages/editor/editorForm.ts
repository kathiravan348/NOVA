import { z } from "zod";
import {
  ExchangeSchema,
  RuleGroupCombinatorSchema,
  SegmentSchema,
  StrategySpecPythonSchema,
  StrategySpecVisualSchema,
  TimeframeSchema,
  type RuleGroup,
  type StrategySpec,
} from "@nova/contracts";
import {
  ExtrasFormShape,
  emptyExtras,
  extrasFromSpec,
  extrasIssues,
  extrasToSpec,
} from "./editorFormExtras";
import {
  ConditionFormSchema,
  emptyOperand,
  isPositive,
  isPositiveInt,
  operandFromSpec,
  operandIssues,
  operandToSpec,
} from "./operandForm";

export { defaultParams, emptyOperand, OperandFormSchema, type OperandForm } from "./operandForm";

/**
 * Form shape for the strategy editor (visual rules or Python). Numeric inputs stay strings
 * (what `<input>` gives) and are checked here; `toSpec` turns a valid form into a contract spec.
 * Rule groups are only validated in visual mode, so hidden rows never block a Python save.
 * The D62 exits, portfolio and market filter live in `editorFormExtras.ts`.
 */

export const RuleGroupFormSchema = z.object({
  combinator: RuleGroupCombinatorSchema,
  conditions: z.array(ConditionFormSchema),
});
export type RuleGroupForm = z.infer<typeof RuleGroupFormSchema>;

/** Python mode API (D47): no imports (math is available); names must not start with "_". */
export const PYTHON_TEMPLATE = `# on_bar runs once per closed bar of each symbol.
# Return "enter", "exit" or None. ctx: symbol, time, open, high, low, close,
# volume, index, closes, sma(n), highest(n), lowest(n). Prices are in rupees.
# Any indicator: ctx.rsi(14), ctx.supertrend(10, 3), ctx.macd_signal(12, 26, 9, ago=1).
class Strategy:
    def on_bar(self, ctx):
        average = ctx.sma(20)
        if average is None:
            return None
        if ctx.close > average:
            return "enter"
        if ctx.close < average:
            return "exit"
        return None
`;

export const EditorFormSchema = z
  .object({
    mode: z.enum(["visual", "python"]),
    name: z.string().trim().min(1, "Name is required"),
    description: z.string(),
    segment: SegmentSchema,
    exchange: ExchangeSchema,
    timeframe: TimeframeSchema,
    sizingType: z.enum(["fixed_qty", "fixed_amount", "percent_equity"]),
    qty: z.string(),
    amountRupees: z.string(),
    percent: z.string(),
    stopLossPercent: z.string(),
    targetPercent: z.string(),
    /** Cost averaging (D53): off unless switched on. */
    averagingOn: z.boolean(),
    averagingDrop: z.string(),
    averagingMaxAdds: z.string(),
    entry: RuleGroupFormSchema,
    exit: RuleGroupFormSchema,
    code: z.string(),
    ...ExtrasFormShape,
  })
  .superRefine((f, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if (f.sizingType === "fixed_qty" && !isPositiveInt(f.qty)) {
      issue(["qty"], "Whole number above 0");
    }
    if (f.sizingType === "fixed_amount" && !isPositive(f.amountRupees)) {
      issue(["amountRupees"], "Amount above 0");
    }
    if (f.sizingType === "percent_equity" && !(isPositive(f.percent) && Number(f.percent) <= 100)) {
      issue(["percent"], "Between 0 and 100");
    }
    for (const key of ["stopLossPercent", "targetPercent"] as const) {
      if (f[key].trim() !== "" && !isPositive(f[key])) issue([key], "Leave empty or above 0");
    }
    if (f.averagingOn) {
      if (!(isPositive(f.averagingDrop) && Number(f.averagingDrop) <= 50)) {
        issue(["averagingDrop"], "Between 0 and 50");
      }
      const adds = Number(f.averagingMaxAdds);
      if (!(isPositiveInt(f.averagingMaxAdds) && adds <= 10)) {
        issue(["averagingMaxAdds"], "Whole number from 1 to 10");
      }
    }
    extrasIssues(f, issue);
    if (f.mode === "python") {
      if (f.code.trim() === "") issue(["code"], "Code is required");
      return;
    }
    for (const group of ["entry", "exit"] as const) {
      if (f[group].conditions.length === 0) {
        issue([group, "conditions"], "Add at least one condition");
      }
      f[group].conditions.forEach((c, i) => {
        for (const side of ["left", "right"] as const) {
          for (const [path, message] of operandIssues(c[side])) {
            issue([group, "conditions", i, side, ...path], message);
          }
        }
      });
    }
  });
export type EditorForm = z.infer<typeof EditorFormSchema>;

export const emptyCondition = (): RuleGroupForm["conditions"][number] => ({
  left: emptyOperand("price"),
  op: "crosses_above",
  right: emptyOperand("indicator"),
});

export const emptyForm = (): EditorForm => ({
  mode: "visual",
  name: "",
  description: "",
  segment: "equity_intraday",
  exchange: "NSE",
  timeframe: "5m",
  sizingType: "fixed_qty",
  qty: "",
  amountRupees: "",
  percent: "",
  stopLossPercent: "",
  targetPercent: "",
  averagingOn: false,
  averagingDrop: "5",
  averagingMaxAdds: "3",
  entry: { combinator: "all", conditions: [emptyCondition()] },
  exit: { combinator: "any", conditions: [emptyCondition()] },
  code: "",
  ...emptyExtras(),
});

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

/** Rotation specs are not editable here yet (D62): the editor page refuses them before this. */
export function fromSpec(
  name: string,
  description: string,
  spec: Exclude<StrategySpec, { mode: "rotation" }>,
): EditorForm {
  const form = emptyForm();
  return {
    ...form,
    mode: spec.mode,
    name,
    description,
    segment: spec.segment,
    exchange: spec.exchange,
    timeframe: spec.timeframe,
    sizingType: spec.sizing.type,
    qty: spec.sizing.type === "fixed_qty" ? String(spec.sizing.qty) : "",
    amountRupees: spec.sizing.type === "fixed_amount" ? String(spec.sizing.amountPaise / 100) : "",
    percent: spec.sizing.type === "percent_equity" ? String(spec.sizing.percent) : "",
    stopLossPercent: spec.risk.stopLossPercent === null ? "" : String(spec.risk.stopLossPercent),
    targetPercent: spec.risk.targetPercent === null ? "" : String(spec.risk.targetPercent),
    ...(spec.averaging
      ? {
          averagingOn: true,
          averagingDrop: String(spec.averaging.dropPercent),
          averagingMaxAdds: String(spec.averaging.maxAdds),
        }
      : {}),
    ...(spec.mode === "visual"
      ? { entry: groupFromSpec(spec.entry), exit: groupFromSpec(spec.exit) }
      : { code: spec.code }),
    ...extrasFromSpec(spec),
  };
}

const optionalPercent = (v: string) => (v.trim() === "" ? null : Number(v));

/** Valid form → contract spec, checked with the contract schema for its mode. */
export function toSpec(form: EditorForm): Exclude<StrategySpec, { mode: "rotation" }> {
  const extras = extrasToSpec(form);
  const base = {
    segment: form.segment,
    exchange: form.exchange,
    timeframe: form.timeframe,
    sizing:
      form.sizingType === "fixed_qty"
        ? { type: "fixed_qty", qty: Number(form.qty) }
        : form.sizingType === "fixed_amount"
          ? { type: "fixed_amount", amountPaise: Math.round(Number(form.amountRupees) * 100) }
          : { type: "percent_equity", percent: Number(form.percent) },
    risk: {
      stopLossPercent: optionalPercent(form.stopLossPercent),
      targetPercent: optionalPercent(form.targetPercent),
      ...extras.risk,
    },
    // Written only when on, so specs without it round-trip unchanged (D53, D62).
    ...(form.averagingOn
      ? {
          averaging: {
            dropPercent: Number(form.averagingDrop),
            maxAdds: Number(form.averagingMaxAdds),
          },
        }
      : {}),
    ...(extras.portfolio ? { portfolio: extras.portfolio } : {}),
    ...(extras.regime ? { regime: extras.regime } : {}),
  };
  if (form.mode === "python") {
    return StrategySpecPythonSchema.parse({ mode: "python", ...base, code: form.code });
  }
  return StrategySpecVisualSchema.parse({
    mode: "visual",
    ...base,
    entry: groupToSpec(form.entry),
    exit: groupToSpec(form.exit),
  });
}
