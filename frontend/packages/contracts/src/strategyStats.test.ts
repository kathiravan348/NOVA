import { describe, expect, it } from "vitest";
import { StrategyStatsSchema, type StrategyStats } from "./strategyStats";

const withRuns: StrategyStats = {
  strategyId: "stg_001",
  runsTotal: 3,
  runsCompleted: 2,
  runsFailed: 0,
  runsInProgress: 1,
  lastRunAt: "2026-09-21T06:20:00Z",
  bestReturnPercent: 0.5,
  worstReturnPercent: 0.46,
  winRateMinPercent: 70,
  winRateMaxPercent: 75,
  worstDrawdownPercent: -0.11,
  bestNetPnl: { runId: "run_001", netPnlPaise: 499474 },
};

const noCompleted: StrategyStats = {
  strategyId: "stg_002",
  runsTotal: 1,
  runsCompleted: 0,
  runsFailed: 0,
  runsInProgress: 1,
  lastRunAt: "2026-09-21T06:15:00Z",
  bestReturnPercent: null,
  worstReturnPercent: null,
  winRateMinPercent: null,
  winRateMaxPercent: null,
  worstDrawdownPercent: null,
  bestNetPnl: null,
};

describe("StrategyStatsSchema", () => {
  it("accepts stats with and without completed runs", () => {
    expect(StrategyStatsSchema.parse(withRuns)).toEqual(withRuns);
    expect(StrategyStatsSchema.parse(noCompleted)).toEqual(noCompleted);
  });

  it("accepts a strategy with no runs at all", () => {
    const none = { ...noCompleted, runsTotal: 0, runsInProgress: 0, lastRunAt: null };
    expect(StrategyStatsSchema.safeParse(none).success).toBe(true);
  });

  it("rejects counts that do not add up", () => {
    expect(StrategyStatsSchema.safeParse({ ...withRuns, runsTotal: 4 }).success).toBe(false);
  });

  it("rejects missing or unexpected result stats", () => {
    expect(StrategyStatsSchema.safeParse({ ...withRuns, bestNetPnl: null }).success).toBe(false);
    expect(StrategyStatsSchema.safeParse({ ...noCompleted, bestReturnPercent: 1 }).success).toBe(
      false,
    );
  });

  it("rejects worst above best, min above max and positive drawdown", () => {
    expect(StrategyStatsSchema.safeParse({ ...withRuns, worstReturnPercent: 0.6 }).success).toBe(
      false,
    );
    expect(StrategyStatsSchema.safeParse({ ...withRuns, winRateMinPercent: 80 }).success).toBe(
      false,
    );
    expect(StrategyStatsSchema.safeParse({ ...withRuns, worstDrawdownPercent: 1 }).success).toBe(
      false,
    );
  });

  it("rejects lastRunAt without runs and extra keys", () => {
    expect(
      StrategyStatsSchema.safeParse({ ...noCompleted, runsTotal: 0, runsInProgress: 0 }).success,
    ).toBe(false);
    expect(StrategyStatsSchema.safeParse({ ...withRuns, extra: 1 }).success).toBe(false);
  });
});
