import { z } from "zod";
import type { Portfolio, Regime, Risk, StrategySpec } from "@nova/contracts";
import {
  ConditionFormSchema,
  OperandFormSchema,
  defaultParams,
  emptyOperand,
  isNumber,
  isPositive,
  isPositiveInt,
  operandFromSpec,
  operandIssues,
  operandToSpec,
  type OperandForm,
} from "./operandForm";

/**
 * Editor fields for the D62 (3) settings: trailing / ATR / time exits, the portfolio limit with its
 * rank, and the market filter. An empty field or a switched-off card means absent, and absent is
 * never written, so specs without these settings round-trip unchanged.
 */

export const ExtrasFormShape = {
  trailingStopPercent: z.string(),
  atrOn: z.boolean(),
  atrPeriod: z.string(),
  atrMultiplier: z.string(),
  maxHoldBars: z.string(),
  maxPositions: z.string(),
  rankOn: z.boolean(),
  rank: OperandFormSchema,
  rankOrder: z.enum(["desc", "asc"]),
  regimeOn: z.boolean(),
  regimeIndex: z.string(),
  regime: ConditionFormSchema,
  regimeWhenOff: z.enum(["no_new_entries", "exit_all"]),
};
export type ExtrasForm = z.infer<z.ZodObject<typeof ExtrasFormShape>>;

type Issue = (path: (string | number)[], message: string) => void;

const inRange = (v: string, low: number, high: number, whole: boolean) =>
  isNumber(v) && Number(v) >= low && Number(v) <= high && (!whole || Number.isInteger(Number(v)));

const rocOperand = (): OperandForm => ({
  ...emptyOperand("indicator"),
  name: "roc",
  params: { ...defaultParams("roc"), period: "126" },
});

/** Default when switched on: NIFTY 50 close above its 200-day SMA, no new buys (D62). */
const smaCondition = (): ExtrasForm["regime"] => ({
  left: emptyOperand("price"),
  op: "gt",
  right: { ...emptyOperand("indicator"), params: { period: "200" } },
});

export const emptyExtras = (): ExtrasForm => ({
  trailingStopPercent: "",
  atrOn: false,
  atrPeriod: "14",
  atrMultiplier: "3",
  maxHoldBars: "",
  maxPositions: "",
  rankOn: false,
  rank: rocOperand(),
  rankOrder: "desc",
  regimeOn: false,
  regimeIndex: "NIFTY 50",
  regime: smaCondition(),
  regimeWhenOff: "no_new_entries",
});

/** Adds a form issue for every out-of-range D62 field; rotation has no portfolio card. */
export function extrasIssues(f: ExtrasForm, issue: Issue, portfolio = true): void {
  if (
    f.trailingStopPercent.trim() !== "" &&
    !(isPositive(f.trailingStopPercent) && Number(f.trailingStopPercent) <= 50)
  ) {
    issue(["trailingStopPercent"], "Leave empty, or above 0 and at most 50");
  }
  if (f.atrOn) {
    if (!isPositiveInt(f.atrPeriod)) issue(["atrPeriod"], "Whole number above 0");
    if (!isPositive(f.atrMultiplier)) issue(["atrMultiplier"], "Number above 0");
  }
  if (f.maxHoldBars.trim() !== "" && !inRange(f.maxHoldBars, 1, 5000, true)) {
    issue(["maxHoldBars"], "Leave empty or a whole number from 1 to 5000");
  }
  if (portfolio && f.maxPositions.trim() !== "" && !inRange(f.maxPositions, 1, 100, true)) {
    issue(["maxPositions"], "Leave empty or a whole number from 1 to 100");
  }
  if (portfolio && f.maxPositions.trim() !== "" && f.rankOn) {
    for (const [path, message] of operandIssues(f.rank)) issue(["rank", ...path], message);
  }
  if (f.regimeOn) {
    if (f.regimeIndex.trim() === "") issue(["regimeIndex"], "Choose an index");
    for (const side of ["left", "right"] as const) {
      for (const [path, message] of operandIssues(f.regime[side])) {
        issue(["regime", side, ...path], message);
      }
    }
  }
}

/** `whenOff`: the market filter's choice when the spec has none (rotation defaults to selling). */
export function extrasFromSpec(
  spec: StrategySpec,
  whenOff: ExtrasForm["regimeWhenOff"],
): ExtrasForm {
  const form = emptyExtras();
  const { risk, regime } = spec;
  const portfolio = spec.mode === "rotation" ? undefined : spec.portfolio;
  return {
    ...form,
    regimeWhenOff: whenOff,
    trailingStopPercent:
      risk.trailingStopPercent === undefined ? "" : String(risk.trailingStopPercent),
    ...(risk.atrStop
      ? {
          atrOn: true,
          atrPeriod: String(risk.atrStop.period),
          atrMultiplier: String(risk.atrStop.multiplier),
        }
      : {}),
    maxHoldBars: risk.maxHoldBars === undefined ? "" : String(risk.maxHoldBars),
    ...(portfolio
      ? {
          maxPositions: String(portfolio.maxPositions),
          ...(portfolio.rank
            ? {
                rankOn: true,
                rank: operandFromSpec(portfolio.rank.by),
                rankOrder: portfolio.rank.order,
              }
            : {}),
        }
      : {}),
    ...(regime
      ? {
          regimeOn: true,
          regimeIndex: regime.index,
          regime: {
            left: operandFromSpec(regime.condition.left),
            op: regime.condition.op,
            right: operandFromSpec(regime.condition.right),
          },
          regimeWhenOff: regime.whenOff,
        }
      : {}),
  };
}

type RiskExtras = Pick<Risk, "trailingStopPercent" | "atrStop" | "maxHoldBars">;

/** The D62 parts of a spec: extra `risk` keys, and `portfolio` / `regime` when set. */
export function extrasToSpec(f: ExtrasForm): {
  risk: RiskExtras;
  portfolio?: Portfolio;
  regime?: Regime;
} {
  const risk: RiskExtras = {
    ...(f.trailingStopPercent.trim() !== ""
      ? { trailingStopPercent: Number(f.trailingStopPercent) }
      : {}),
    ...(f.atrOn
      ? { atrStop: { period: Number(f.atrPeriod), multiplier: Number(f.atrMultiplier) } }
      : {}),
    ...(f.maxHoldBars.trim() !== "" ? { maxHoldBars: Number(f.maxHoldBars) } : {}),
  };
  const rankBy = operandToSpec(f.rank);
  const portfolio: Portfolio | undefined =
    f.maxPositions.trim() === ""
      ? undefined
      : {
          maxPositions: Number(f.maxPositions),
          ...(f.rankOn && rankBy.kind !== "number"
            ? { rank: { by: rankBy, order: f.rankOrder } }
            : {}),
        };
  const regime: Regime | undefined = f.regimeOn
    ? {
        index: f.regimeIndex,
        condition: {
          left: operandToSpec(f.regime.left),
          op: f.regime.op,
          right: operandToSpec(f.regime.right),
        },
        whenOff: f.regimeWhenOff,
      }
    : undefined;
  return {
    risk,
    ...(portfolio ? { portfolio } : {}),
    ...(regime ? { regime } : {}),
  };
}
