import { z } from "zod";
import {
  ExchangeSchema,
  SegmentSchema,
  StrategySpecPythonSchema,
  StrategySpecRotationSchema,
  StrategySpecVisualSchema,
  TimeframeSchema,
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
  RotationFormShape,
  emptyRotation,
  rotationFromSpec,
  rotationIssues,
  rotationToSpec,
} from "./editorFormRotation";
import {
  RuleGroupFormSchema,
  emptyCondition,
  groupFromSpec,
  groupIssues,
  groupToSpec,
  isPositive,
  isPositiveInt,
} from "./operandForm";

export {
  defaultParams,
  emptyCondition,
  emptyOperand,
  OperandFormSchema,
  RuleGroupFormSchema,
  type OperandForm,
  type RuleGroupForm,
} from "./operandForm";

/**
 * Form shape for the strategy editor (visual rules, Python or rotation). Numeric inputs stay
 * strings (what `<input>` gives) and are checked here; `toSpec` turns a valid form into a contract
 * spec. Only the chosen mode's fields are checked, so hidden fields never block a save. The D62
 * exits, portfolio and market filter live in `editorFormExtras.ts`, rotation in
 * `editorFormRotation.ts`.
 */

export type EditorMode = "visual" | "python" | "rotation";

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
    mode: z.enum(["visual", "python", "rotation"]),
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
    ...RotationFormShape,
  })
  .superRefine((f, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    for (const key of ["stopLossPercent", "targetPercent"] as const) {
      if (f[key].trim() !== "" && !isPositive(f[key])) issue([key], "Leave empty or above 0");
    }
    extrasIssues(f, issue, f.mode !== "rotation");
    if (f.mode === "rotation") {
      rotationIssues(f, issue);
      return;
    }
    if (f.sizingType === "fixed_qty" && !isPositiveInt(f.qty)) {
      issue(["qty"], "Whole number above 0");
    }
    if (f.sizingType === "fixed_amount" && !isPositive(f.amountRupees)) {
      issue(["amountRupees"], "Amount above 0");
    }
    if (f.sizingType === "percent_equity" && !(isPositive(f.percent) && Number(f.percent) <= 100)) {
      issue(["percent"], "Between 0 and 100");
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
    if (f.mode === "python") {
      if (f.code.trim() === "") issue(["code"], "Code is required");
      return;
    }
    groupIssues(f.entry, "entry", issue);
    groupIssues(f.exit, "exit", issue);
  });
export type EditorForm = z.infer<typeof EditorFormSchema>;

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
  ...emptyRotation(),
});

/** A fresh form for a mode: Python starts from a template; rotation is daily delivery (D62). */
export function modeDefaults(mode: EditorMode): EditorForm {
  const form = emptyForm();
  if (mode === "python") return { ...form, mode, code: PYTHON_TEMPLATE };
  if (mode === "rotation") {
    return {
      ...form,
      mode,
      segment: "equity_delivery",
      timeframe: "1d",
      regimeWhenOff: "exit_all",
    };
  }
  return form;
}

/** Whether switching away from this form's mode would lose settings (name and description stay). */
export function hasModeWork(form: EditorForm): boolean {
  const strip = (f: EditorForm) => ({ ...f, name: "", description: "" });
  return JSON.stringify(strip(form)) !== JSON.stringify(strip(modeDefaults(form.mode)));
}

export function fromSpec(name: string, description: string, spec: StrategySpec): EditorForm {
  const shared = {
    name,
    description,
    exchange: spec.exchange,
    stopLossPercent: spec.risk.stopLossPercent === null ? "" : String(spec.risk.stopLossPercent),
    targetPercent: spec.risk.targetPercent === null ? "" : String(spec.risk.targetPercent),
  };
  if (spec.mode === "rotation") {
    return {
      ...modeDefaults("rotation"),
      ...shared,
      ...extrasFromSpec(spec, "exit_all"),
      ...rotationFromSpec(spec),
    };
  }
  return {
    ...emptyForm(),
    ...shared,
    mode: spec.mode,
    segment: spec.segment,
    timeframe: spec.timeframe,
    sizingType: spec.sizing.type,
    qty: spec.sizing.type === "fixed_qty" ? String(spec.sizing.qty) : "",
    amountRupees: spec.sizing.type === "fixed_amount" ? String(spec.sizing.amountPaise / 100) : "",
    percent: spec.sizing.type === "percent_equity" ? String(spec.sizing.percent) : "",
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
    ...extrasFromSpec(spec, "no_new_entries"),
  };
}

const optionalPercent = (v: string) => (v.trim() === "" ? null : Number(v));

/** Valid form → contract spec, checked with the contract schema for its mode. */
export function toSpec(form: EditorForm): StrategySpec {
  const extras = extrasToSpec(form);
  const risk = {
    stopLossPercent: optionalPercent(form.stopLossPercent),
    targetPercent: optionalPercent(form.targetPercent),
    ...extras.risk,
  };
  const regime = extras.regime ? { regime: extras.regime } : {};
  if (form.mode === "rotation") {
    return StrategySpecRotationSchema.parse({
      mode: "rotation",
      segment: "equity_delivery",
      exchange: form.exchange,
      timeframe: "1d",
      risk,
      ...regime,
      rotation: rotationToSpec(form),
    });
  }
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
    risk,
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
    ...regime,
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
