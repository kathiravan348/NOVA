import type {
  Condition,
  ConditionOp,
  Operand,
  PriceField,
  Risk,
  RuleGroup,
  Sizing,
  Universe,
} from "@nova/contracts";
import { indicatorDef } from "@nova/contracts";
import { formatInr } from "@nova/ui-trading";

const priceLabel: Record<PriceField, string> = {
  open: "Open",
  high: "High",
  low: "Low",
  close: "Close",
  volume: "Volume",
};

const opLabel: Record<ConditionOp, string> = {
  crosses_above: "crosses above",
  crosses_below: "crosses below",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  eq: "=",
};

const barsAgo = (offset: number | undefined) =>
  offset ? ` ${offset} ${offset === 1 ? "bar" : "bars"} ago` : "";

/**
 * `Close`, `High 1 bar ago`, `VWAP`, `RSI(14)`, `MACD signal(12, 26, 9)`, `Pivot R1`: catalog labels
 * (D51), settings in catalog order (unknown old keys after them), numbers as written.
 */
export function describeOperand(operand: Operand): string {
  switch (operand.kind) {
    case "price":
      return priceLabel[operand.field] + barsAgo(operand.offset);
    case "number":
      return String(operand.value);
    case "indicator": {
      const def = indicatorDef(operand.name);
      const known = (def?.params ?? []).map((p) => p.key).filter((k) => k in operand.params);
      const keys = [...known, ...Object.keys(operand.params).filter((k) => !known.includes(k))];
      const values = keys.map((k) => operand.params[k]);
      const name = def?.label ?? operand.name;
      const text = values.length > 0 ? `${name}(${values.join(", ")})` : name;
      return text + barsAgo(operand.offset);
    }
  }
}

export function describeCondition(condition: Condition): string {
  return `${describeOperand(condition.left)} ${opLabel[condition.op]} ${describeOperand(condition.right)}`;
}

export function describeRuleGroup(group: RuleGroup): { heading: string; lines: string[] } {
  return {
    heading: group.combinator === "all" ? "All of" : "Any of",
    lines: group.conditions.map(describeCondition),
  };
}

export function describeUniverse(universe: Universe): string {
  return universe.type === "index" ? `${universe.index} stocks` : universe.symbols.join(", ");
}

/** Short form for lists: `NIFTY BANK`, `TCS, INFY` (up to 3 names) or `12 symbols`. */
export function summarizeUniverse(universe: Universe): string {
  if (universe.type === "index") return universe.index;
  const { symbols } = universe;
  return symbols.length <= 3 ? symbols.join(", ") : `${symbols.length} symbols`;
}

export function describeSizing(sizing: Sizing): string {
  switch (sizing.type) {
    case "fixed_qty":
      return `${sizing.qty} shares per trade`;
    case "fixed_amount":
      return `${formatInr(sizing.amountPaise, { decimals: 0 })} per trade`;
    case "percent_equity":
      return `${sizing.percent}% of equity per trade`;
  }
}

export function describeRisk(risk: Risk): string {
  const parts: string[] = [];
  if (risk.stopLossPercent !== null) parts.push(`Stop-loss ${risk.stopLossPercent}%`);
  if (risk.targetPercent !== null) parts.push(`Target ${risk.targetPercent}%`);
  return parts.length > 0 ? parts.join(" · ") : "None";
}
