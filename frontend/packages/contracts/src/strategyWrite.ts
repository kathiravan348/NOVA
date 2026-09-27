import { z } from "zod";
import { checkIndicatorParams } from "./indicators";
import {
  StrategySpecSchema,
  StrategyStatusSchema,
  type Condition,
  type Operand,
  type RuleGroup,
  type StrategySpec,
} from "./strategy";

const groupOperands = (group: RuleGroup | undefined): Operand[] =>
  group ? group.conditions.flatMap((c: Condition) => [c.left, c.right]) : [];

/** Every operand of a spec: rules, rank, market filter, rotation score and filter (D51, D62). */
export function specOperands(spec: StrategySpec): Operand[] {
  const regime = spec.regime ? [spec.regime.condition.left, spec.regime.condition.right] : [];
  if (spec.mode === "rotation") {
    return [
      ...regime,
      ...spec.rotation.score.map((t) => t.operand),
      ...groupOperands(spec.rotation.filter),
    ];
  }
  const rank = spec.portfolio?.rank ? [spec.portfolio.rank.by] : [];
  const rules =
    spec.mode === "visual" ? [...groupOperands(spec.entry), ...groupOperands(spec.exit)] : [];
  return [...rules, ...rank, ...regime];
}

/** Indicator settings problems anywhere in a spec (D51, D62); write bodies refuse them, reads stay tolerant. */
export function specParamProblems(spec: StrategySpec): string[] {
  return specOperands(spec).flatMap((o) =>
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
