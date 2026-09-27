import type {
  Averaging,
  Condition,
  ConditionOp,
  Operand,
  Portfolio,
  PriceField,
  Regime,
  Risk,
  Rotation,
  RuleGroup,
  Sizing,
  StrategySpec,
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
  const times =
    operand.kind !== "number" && operand.multiplier !== undefined && operand.multiplier !== 1
      ? `${operand.multiplier} × `
      : "";
  return times + describeBare(operand);
}

function describeBare(operand: Operand): string {
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

/** "Buy again every 5% fall, up to 3 times" or "Off" (D53). */
export function describeAveraging(averaging: Averaging | undefined): string {
  if (!averaging) return "Off";
  const times = averaging.maxAdds === 1 ? "once" : `up to ${averaging.maxAdds} times`;
  return `Buy again every ${averaging.dropPercent}% fall, ${times}`;
}

export function describeRisk(risk: Risk): string {
  const parts: string[] = [];
  if (risk.stopLossPercent !== null) parts.push(`Stop-loss ${risk.stopLossPercent}%`);
  if (risk.targetPercent !== null) parts.push(`Target ${risk.targetPercent}%`);
  return parts.length > 0 ? parts.join(" · ") : "None";
}

const modeNames: Record<StrategySpec["mode"], string> = {
  visual: "Visual",
  python: "Python",
  rotation: "Rotation",
};

/** "Visual", "Python" or "Rotation" (D62). */
export function modeLabel(mode: StrategySpec["mode"]): string {
  return modeNames[mode];
}

/** Trailing, ATR and time exits (D62): "Trailing 15% · 3 × ATR(20) · After 60 bars" or "None". */
export function describeExits(risk: Risk): string {
  const parts: string[] = [];
  if (risk.trailingStopPercent !== undefined) parts.push(`Trailing ${risk.trailingStopPercent}%`);
  if (risk.atrStop) parts.push(`${risk.atrStop.multiplier} × ATR(${risk.atrStop.period}) trailing`);
  if (risk.maxHoldBars !== undefined) {
    parts.push(`After ${risk.maxHoldBars} ${risk.maxHoldBars === 1 ? "bar" : "bars"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "None";
}

/** "Up to 10 · ranked by ROC(126), highest first" or "No limit" (D62). */
export function describePortfolio(portfolio: Portfolio | undefined): string {
  if (!portfolio) return "No limit";
  const rank = portfolio.rank
    ? ` · ranked by ${describeOperand(portfolio.rank.by)}, ${portfolio.rank.order === "desc" ? "highest" : "lowest"} first`
    : "";
  return `Up to ${portfolio.maxPositions}${rank}`;
}

/** "NIFTY 50: Close > SMA(200); otherwise no new buys" or "Off" (D62). */
export function describeRegime(regime: Regime | undefined): string {
  if (!regime) return "Off";
  const off = regime.whenOff === "exit_all" ? "sell everything" : "no new buys";
  return `${regime.index}: ${describeCondition(regime.condition)}; otherwise ${off}`;
}

const rebalanceLabel: Record<Rotation["rebalance"], string> = {
  weekly: "Every week",
  monthly: "Every month",
  quarterly: "Every quarter",
};

/** Rotation settings in words (D62 (4)). */
export function describeRotation(rotation: Rotation): {
  rebalance: string;
  hold: string;
  score: string[];
  filter: ReturnType<typeof describeRuleGroup> | null;
} {
  return {
    rebalance: rebalanceLabel[rotation.rebalance],
    hold: `Top ${rotation.hold}, kept while in the top ${rotation.keepWithin}`,
    score: rotation.score.map((t) => `${describeOperand(t.operand)} × weight ${t.weight}`),
    filter: rotation.filter ? describeRuleGroup(rotation.filter) : null,
  };
}
