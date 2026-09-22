import { describe, expect, it } from "vitest";
import { mockBacktestResults } from "@nova/mocks";
import type { BacktestMetrics } from "@nova/contracts";
import { METRIC_ROWS, bestRunId, parseRunIds, toSearch } from "./compareMetrics";

const row = (key: string) => METRIC_ROWS.find((r) => r.key === key)!;
const [a, b] = mockBacktestResults.map((r) => ({ id: r.runId, metrics: r.metrics }));
const withMetrics = (id: string, patch: Partial<BacktestMetrics>) => ({
  id,
  metrics: { ...a!.metrics, ...patch },
});

describe("compareMetrics", () => {
  it("parses run ids: unique, trimmed, at most three", () => {
    expect(parseRunIds(null)).toEqual([]);
    expect(parseRunIds("")).toEqual([]);
    expect(parseRunIds("run_1, run_2,run_1")).toEqual(["run_1", "run_2"]);
    expect(parseRunIds("a,b,c,d")).toEqual(["a", "b", "c"]);
    expect(toSearch(["a", "b"])).toBe("a,b");
  });

  it("picks the best run in the right direction", () => {
    expect(bestRunId(row("net"), [a!, b!])).toBe("run_001");
    expect(bestRunId(row("charges"), [a!, b!])).toBe("run_002");
    expect(
      bestRunId(row("drawdown"), [
        withMetrics("x", { maxDrawdownPercent: -3 }),
        withMetrics("y", { maxDrawdownPercent: -1 }),
      ]),
    ).toBe("y");
  });

  it("returns null for ties, unranked rows and single runs", () => {
    expect(bestRunId(row("drawdown"), [a!, b!])).toBeNull();
    expect(bestRunId(row("trades"), [a!, b!])).toBeNull();
    expect(bestRunId(row("net"), [a!])).toBeNull();
  });

  it("formats with explicit signs", () => {
    expect(row("net").format(a!.metrics)).toBe("+₹4,994.74");
    expect(row("drawdown").format(a!.metrics)).toBe("−0.11%");
  });
});
