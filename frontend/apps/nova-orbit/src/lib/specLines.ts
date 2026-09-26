import type { RuleGroup, StrategySpec } from "@nova/contracts";
import { segmentLabel, timeframeLabel } from "./format";
import { describeAveraging, describeRuleGroup, describeSizing } from "./strategyText";

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

function ruleLines(name: "Entry" | "Exit", group: RuleGroup): SpecLine[] {
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

/** A strategy spec as ordered rows: settings, then rules (visual) or code lines (Python). */
export function specLines(spec: StrategySpec): SpecLine[] {
  const settings: SpecLine[] = [
    { key: "mode", label: "Mode", value: spec.mode === "visual" ? "Visual rules" : "Python" },
    { key: "segment", label: "Segment", value: segmentLabel[spec.segment] },
    { key: "exchange", label: "Exchange", value: spec.exchange },
    { key: "timeframe", label: "Timeframe", value: timeframeLabel[spec.timeframe] },
    { key: "sizing", label: "Sizing", value: describeSizing(spec.sizing) },
    { key: "stop", label: "Stop-loss", value: percentOrNone(spec.risk.stopLossPercent) },
    { key: "target", label: "Target", value: percentOrNone(spec.risk.targetPercent) },
    { key: "averaging", label: "Cost averaging", value: describeAveraging(spec.averaging) },
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
