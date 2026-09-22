import type {
  Condition,
  ConditionOp,
  IndicatorName,
  Operand,
  PriceField,
  Risk,
  RuleGroup,
  Sizing,
  Universe,
} from "@nova/contracts";
import { formatInr } from "@nova/ui-trading";

const priceLabel: Record<PriceField, string> = {
  open: "Open",
  high: "High",
  low: "Low",
  close: "Close",
  volume: "Volume",
};

const indicatorLabel: Record<IndicatorName, string> = {
  sma: "SMA",
  ema: "EMA",
  rsi: "RSI",
  macd: "MACD",
  vwap: "VWAP",
  atr: "ATR",
  bb_upper: "Bollinger upper",
  bb_lower: "Bollinger lower",
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

/** `Close`, `VWAP`, `RSI(14)`, `SMA(period 20)` → params in key order; numbers as written. */
export function describeOperand(operand: Operand): string {
  switch (operand.kind) {
    case "price":
      return priceLabel[operand.field];
    case "number":
      return String(operand.value);
    case "indicator": {
      const values = Object.values(operand.params);
      const name = indicatorLabel[operand.name];
      return values.length > 0 ? `${name}(${values.join(", ")})` : name;
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
