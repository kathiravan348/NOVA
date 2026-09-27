import { z } from "zod";
import {
  ConditionOpSchema,
  IndicatorNameSchema,
  PriceFieldSchema,
  RuleGroupCombinatorSchema,
  indicatorDef,
  type IndicatorName,
  type Operand,
  type RuleGroup,
} from "@nova/contracts";

/**
 * One operand of a rule, a rank, a score or the market filter as form strings (what `<input>`
 * gives), rule groups made of them, their checks and their conversion to and from the contract
 * (D51, D62).
 */

export const isNumber = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
export const isPositive = (v: string) => isNumber(v) && Number(v) > 0;
export const isPositiveInt = (v: string) => isPositive(v) && Number.isInteger(Number(v));
const isOffset = (v: string) =>
  isNumber(v) && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 500;

export const OperandFormSchema = z.object({
  kind: z.enum(["price", "indicator", "number"]),
  field: PriceFieldSchema,
  name: IndicatorNameSchema,
  /** The indicator's settings by catalog key (D51). */
  params: z.record(z.string(), z.string()),
  /** Bars ago (D51), for price and indicator operands. */
  offset: z.string(),
  /** × this number (D62); empty or 1 = none. */
  multiplier: z.string(),
  value: z.string(),
});
export type OperandForm = z.infer<typeof OperandFormSchema>;

export const ConditionFormSchema = z.object({
  left: OperandFormSchema,
  op: ConditionOpSchema,
  right: OperandFormSchema,
});
export type ConditionForm = z.infer<typeof ConditionFormSchema>;

/** The catalog defaults of an indicator as form strings. */
export function defaultParams(name: IndicatorName): Record<string, string> {
  return Object.fromEntries(
    (indicatorDef(name)?.params ?? []).map((p) => [p.key, String(p.default)]),
  );
}

export const emptyOperand = (kind: OperandForm["kind"]): OperandForm => ({
  kind,
  field: "close",
  name: "sma",
  params: defaultParams("sma"),
  offset: "0",
  multiplier: "",
  value: "0",
});

/** Field problems of an operand as (path below the operand, message) pairs. */
export function operandIssues(o: OperandForm): [string[], string][] {
  const found: [string[], string][] = [];
  if (o.kind === "number") {
    if (!isNumber(o.value)) found.push([["value"], "Enter a number"]);
    return found;
  }
  if (o.kind === "indicator") {
    for (const p of indicatorDef(o.name)?.params ?? []) {
      const v = o.params[p.key] ?? "";
      if (p.integer ? !isPositiveInt(v) : !isPositive(v)) {
        found.push([["params", p.key], p.integer ? "Whole number above 0" : "Number above 0"]);
      }
    }
    const { fast, slow } = o.params;
    if (fast !== undefined && slow !== undefined && isPositive(fast) && isPositive(slow)) {
      if (Number(fast) >= Number(slow)) found.push([["params", "fast"], "Must be less than Slow"]);
    }
  }
  if (!isOffset(o.offset)) found.push([["offset"], "Whole number from 0 to 500"]);
  if (o.multiplier.trim() !== "" && !isPositive(o.multiplier)) {
    found.push([["multiplier"], "Leave empty or above 0"]);
  }
  return found;
}

/** Known settings come from the spec, missing ones get defaults, unknown ones are dropped (D51). */
export function operandFromSpec(o: Operand): OperandForm {
  const base = emptyOperand(o.kind);
  if (o.kind === "number") return { ...base, value: String(o.value) };
  const offset = String(o.offset ?? 0);
  const multiplier = o.multiplier === undefined ? "" : String(o.multiplier);
  if (o.kind === "price") return { ...base, field: o.field, offset, multiplier };
  const params = defaultParams(o.name);
  for (const key of Object.keys(params)) {
    const value = o.params[key];
    if (value !== undefined) params[key] = String(value);
  }
  return { ...base, name: o.name, params, offset, multiplier };
}

export function operandToSpec(o: OperandForm): Operand {
  if (o.kind === "number") return { kind: "number", value: Number(o.value) };
  const offset = Number(o.offset);
  const times = o.multiplier.trim() === "" ? 1 : Number(o.multiplier);
  // Bars ago 0 and × 1 are never written, so older specs round-trip unchanged (D51, D62).
  const extra = {
    ...(offset > 0 ? { offset } : {}),
    ...(times !== 1 ? { multiplier: times } : {}),
  };
  if (o.kind === "price") return { kind: "price", field: o.field, ...extra };
  const params = Object.fromEntries(
    (indicatorDef(o.name)?.params ?? []).map((p) => [p.key, Number(o.params[p.key])]),
  );
  return { kind: "indicator", name: o.name, params, ...extra };
}

export const RuleGroupFormSchema = z.object({
  combinator: RuleGroupCombinatorSchema,
  conditions: z.array(ConditionFormSchema),
});
export type RuleGroupForm = z.infer<typeof RuleGroupFormSchema>;

export const emptyCondition = (): ConditionForm => ({
  left: emptyOperand("price"),
  op: "crosses_above",
  right: emptyOperand("indicator"),
});

/** Adds an issue for an empty group and for every incomplete operand of its conditions. */
export function groupIssues(
  group: RuleGroupForm,
  at: string,
  issue: (path: (string | number)[], message: string) => void,
): void {
  if (group.conditions.length === 0) issue([at, "conditions"], "Add at least one condition");
  group.conditions.forEach((c, i) => {
    for (const side of ["left", "right"] as const) {
      for (const [path, message] of operandIssues(c[side])) {
        issue([at, "conditions", i, side, ...path], message);
      }
    }
  });
}

export const groupFromSpec = (g: RuleGroup): RuleGroupForm => ({
  combinator: g.combinator,
  conditions: g.conditions.map((c) => ({
    left: operandFromSpec(c.left),
    op: c.op,
    right: operandFromSpec(c.right),
  })),
});

export const groupToSpec = (g: RuleGroupForm): RuleGroup => ({
  combinator: g.combinator,
  conditions: g.conditions.map((c) => ({
    left: operandToSpec(c.left),
    op: c.op,
    right: operandToSpec(c.right),
  })),
});
