import { describe, expect, it } from "vitest";
import type { StrategySpecPython, StrategySpecVisual } from "@nova/contracts";
import { mockStrategies } from "@nova/mocks";
import { diffLines, specLines } from "./specLines";

const vwap = mockStrategies.find((s) => s.id === "stg_001")!;
const v1 = vwap.versions.find((v) => v.version === 1)!.spec as StrategySpecVisual;
const v2 = vwap.versions.find((v) => v.version === 2)!.spec as StrategySpecVisual;
const python = mockStrategies.find((s) => s.id === "stg_002")!.versions[0]!
  .spec as StrategySpecPython;

describe("specLines", () => {
  it("lists settings, then each entry and exit rule of a visual spec", () => {
    const lines = specLines(v2);
    expect(lines.slice(0, 8).map((l) => l.label)).toEqual([
      "Mode",
      "Segment",
      "Exchange",
      "Timeframe",
      "Sizing",
      "Stop-loss",
      "Target",
      "Cost averaging",
    ]);
    expect(lines.find((l) => l.key === "stop")?.value).toBe("1%");
    expect(lines.filter((l) => l.key.startsWith("entry.")).map((l) => l.label)).toEqual([
      "Entry rules",
      "Entry 1",
      "Entry 2",
    ]);
  });

  it("lists a Python spec's code one line per row", () => {
    const lines = specLines(python);
    const code = lines.filter((l) => l.key.startsWith("code."));
    expect(code.length).toBe(python.code.trimEnd().split("\n").length);
    expect(code[0]).toEqual({ key: "code.0", label: "Code 1", value: python.code.split("\n")[0] });
  });
});

describe("diffLines", () => {
  it("marks a changed stop-loss and an added entry rule", () => {
    const diff = diffLines(specLines(v1), specLines(v2));
    const byKey = new Map(diff.map((d) => [d.key, d]));
    expect(byKey.get("stop")).toMatchObject({ a: "1.5%", b: "1%", status: "changed" });
    expect(byKey.get("mode")?.status).toBe("same");
    expect(byKey.get("entry.1")).toMatchObject({ a: null, status: "only-b" });
    const keys = diff.map((d) => d.key);
    expect(keys.indexOf("entry.1")).toBe(keys.indexOf("entry.0") + 1);
  });

  it("marks a changed and a removed code line", () => {
    const [first, ...rest] = python.code.split("\n");
    const edited = { ...python, code: [`${first} # tuned`, ...rest].join("\n") };
    const shorter = { ...python, code: python.code.split("\n").slice(0, 2).join("\n") };
    const changed = diffLines(specLines(python), specLines(edited)).filter(
      (d) => d.status !== "same",
    );
    expect(changed.map((d) => d.status)).toContain("changed");
    const removed = diffLines(specLines(python), specLines(shorter));
    expect(removed.some((d) => d.status === "only-a")).toBe(true);
  });
});
