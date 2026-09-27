import type { RuleGroup, StrategySpec } from "@nova/contracts";
import { segmentLabel, timeframeLabel } from "./format";
import {
  describeAveraging,
  describeExits,
  describePortfolio,
  describeRegime,
  describeRotation,
  describeRuleGroup,
  describeSizing,
} from "./strategyText";

/** One row of a strategy's rules in plain words; `key` pairs rows across versions (D60). */
export interface SpecLine {
  key: string;
  label: string;
  value: string;
}

export type LineStatus = "same" | "changed" | "only-a" | "only-b";

export interface DiffLine {
  key: string;
  label: string;
  a: string | null;
  b: string | null;
  status: LineStatus;
}

const percentOrNone = (value: number | null) => (value === null ? "None" : `${value}%`);

function ruleLines(name: "Entry" | "Exit" | "Filter", group: RuleGroup): SpecLine[] {
  const text = describeRuleGroup(group);
  const prefix = name.toLowerCase();
  return [
    { key: `${prefix}.match`, label: `${name} rules`, value: text.heading },
    ...text.lines.map((line, i) => ({
      key: `${prefix}.${i}`,
      label: `${name} ${i + 1}`,
      value: line,
    })),
  ];
}

const modeText = { visual: "Visual rules", python: "Python", rotation: "Rotation" } as const;

/** Rotation settings, score terms and the optional filter (D62 (4)). */
function rotationLines(spec: Extract<StrategySpec, { mode: "rotation" }>): SpecLine[] {
  const text = describeRotation(spec.rotation);
  return [
    { key: "rebalance", label: "Rebalance", value: text.rebalance },
    { key: "hold", label: "Hold", value: text.hold },
    ...text.score.map((value, i) => ({ key: `score.${i}`, label: `Score ${i + 1}`, value })),
    ...(spec.rotation.filter ? ruleLines("Filter", spec.rotation.filter) : []),
  ];
}

/** A strategy spec as ordered rows: settings, then rules (visual), code lines (Python) or rotation. */
export function specLines(spec: StrategySpec): SpecLine[] {
  const common: SpecLine[] = [
    { key: "mode", label: "Mode", value: modeText[spec.mode] },
    { key: "segment", label: "Segment", value: segmentLabel[spec.segment] },
    { key: "exchange", label: "Exchange", value: spec.exchange },
    { key: "timeframe", label: "Timeframe", value: timeframeLabel[spec.timeframe] },
  ];
  const risk: SpecLine[] = [
    { key: "stop", label: "Stop-loss", value: percentOrNone(spec.risk.stopLossPercent) },
    { key: "target", label: "Target", value: percentOrNone(spec.risk.targetPercent) },
    { key: "exits", label: "Other exits", value: describeExits(spec.risk) },
    { key: "regime", label: "Market filter", value: describeRegime(spec.regime) },
  ];
  if (spec.mode === "rotation") return [...common, ...risk, ...rotationLines(spec)];
  const settings: SpecLine[] = [
    ...common,
    { key: "sizing", label: "Sizing", value: describeSizing(spec.sizing) },
    ...risk,
    { key: "averaging", label: "Cost averaging", value: describeAveraging(spec.averaging) },
    { key: "portfolio", label: "Positions", value: describePortfolio(spec.portfolio) },
  ];
  if (spec.mode === "visual") {
    return [...settings, ...ruleLines("Entry", spec.entry), ...ruleLines("Exit", spec.exit)];
  }
  const code = spec.code.replace(/\s+$/, "").split("\n");
  return [
    ...settings,
    ...code.map((line, i) => ({ key: `code.${i}`, label: `Code ${i + 1}`, value: line })),
  ];
}

/** Rows of two specs paired by key, in order; rows only in `b` follow their neighbour in `b`. */
export function diffLines(a: SpecLine[], b: SpecLine[]): DiffLine[] {
  const keys = a.map((line) => line.key);
  b.forEach((line, i) => {
    if (keys.includes(line.key)) return;
    const before = b
      .slice(0, i)
      .map((l) => l.key)
      .filter((k) => keys.includes(k))
      .at(-1);
    keys.splice(before === undefined ? 0 : keys.indexOf(before) + 1, 0, line.key);
  });
  const byKey = (lines: SpecLine[]) => new Map(lines.map((l) => [l.key, l]));
  const left = byKey(a);
  const right = byKey(b);
  return keys.map((key) => {
    const la = left.get(key);
    const lb = right.get(key);
    const status: LineStatus = !la
      ? "only-b"
      : !lb
        ? "only-a"
        : la.value === lb.value
          ? "same"
          : "changed";
    return { key, label: (la ?? lb)!.label, a: la?.value ?? null, b: lb?.value ?? null, status };
  });
}
