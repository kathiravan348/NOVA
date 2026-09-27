import { z } from "zod";
import type { Rotation, StrategySpecRotation } from "@nova/contracts";
import {
  OperandFormSchema,
  RuleGroupFormSchema,
  defaultParams,
  emptyOperand,
  groupFromSpec,
  groupIssues,
  groupToSpec,
  isNumber,
  isPositiveInt,
  operandFromSpec,
  operandIssues,
  operandToSpec,
  type OperandForm,
} from "./operandForm";

/**
 * Editor fields for rotation mode (D62 (4)): rebalance period, how many to hold, the keep rank,
 * the score (1–3 weighted terms) and an optional filter rule group.
 */

export const MAX_TERMS = 3;

const ScoreTermFormSchema = z.object({ operand: OperandFormSchema, weight: z.string() });
export type ScoreTermForm = z.infer<typeof ScoreTermFormSchema>;

export const RotationFormShape = {
  rebalance: z.enum(["weekly", "monthly", "quarterly"]),
  hold: z.string(),
  keepWithin: z.string(),
  scoreTerms: z.array(ScoreTermFormSchema),
  filterOn: z.boolean(),
  filter: RuleGroupFormSchema,
};
export type RotationForm = z.infer<z.ZodObject<typeof RotationFormShape>>;

type Issue = (path: (string | number)[], message: string) => void;

/** The 6-month rate of change: a common momentum score. */
export const rocTerm = (): ScoreTermForm => ({
  operand: {
    ...emptyOperand("indicator"),
    name: "roc",
    params: { ...defaultParams("roc"), period: "126" },
  },
  weight: "1",
});

const aboveSma200 = (): RotationForm["filter"] => ({
  combinator: "all",
  conditions: [
    {
      left: emptyOperand("price"),
      op: "gt",
      right: { ...emptyOperand("indicator"), params: { period: "200" } },
    },
  ],
});

export const emptyRotation = (): RotationForm => ({
  rebalance: "monthly",
  hold: "10",
  keepWithin: "20",
  scoreTerms: [rocTerm()],
  filterOn: false,
  filter: aboveSma200(),
});

export function rotationIssues(f: RotationForm, issue: Issue): void {
  const holdOk = isPositiveInt(f.hold) && Number(f.hold) <= 50;
  if (!holdOk) issue(["hold"], "Whole number from 1 to 50");
  if (!(isPositiveInt(f.keepWithin) && Number(f.keepWithin) <= 100)) {
    issue(["keepWithin"], "Whole number from 1 to 100");
  } else if (holdOk && Number(f.keepWithin) < Number(f.hold)) {
    issue(["keepWithin"], "At least Hold");
  }
  if (f.scoreTerms.length < 1 || f.scoreTerms.length > MAX_TERMS) {
    issue(["scoreTerms"], "Use 1 to 3 terms");
  }
  f.scoreTerms.forEach((term, i) => {
    for (const [path, message] of operandIssues(term.operand)) {
      issue(["scoreTerms", i, "operand", ...path], message);
    }
    if (!isNumber(term.weight) || Number(term.weight) === 0) {
      issue(["scoreTerms", i, "weight"], "A number other than 0");
    }
  });
  if (f.filterOn) groupIssues(f.filter, "filter", issue);
}

const termOperand = (o: OperandForm) => {
  const operand = operandToSpec(o);
  if (operand.kind === "number") throw new Error("A score term is a price or an indicator");
  return operand;
};

export function rotationFromSpec(spec: StrategySpecRotation): RotationForm {
  const { rotation } = spec;
  return {
    rebalance: rotation.rebalance,
    hold: String(rotation.hold),
    keepWithin: String(rotation.keepWithin),
    scoreTerms: rotation.score.map((t) => ({
      operand: operandFromSpec(t.operand),
      weight: String(t.weight),
    })),
    filterOn: rotation.filter !== undefined,
    filter: rotation.filter ? groupFromSpec(rotation.filter) : aboveSma200(),
  };
}

/** The `rotation` object of a valid form; the filter only when switched on (D62). */
export function rotationToSpec(f: RotationForm): Rotation {
  return {
    rebalance: f.rebalance,
    hold: Number(f.hold),
    keepWithin: Number(f.keepWithin),
    score: f.scoreTerms.map((t) => ({ operand: termOperand(t.operand), weight: Number(t.weight) })),
    ...(f.filterOn ? { filter: groupToSpec(f.filter) } : {}),
  };
}
