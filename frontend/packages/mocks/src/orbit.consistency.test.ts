import { describe, expect, it } from "vitest";
import {
  mockBacktestResults,
  mockBacktestRuns,
  mockStrategies,
  mockStrategyStats,
  mockTrades,
} from "./data";

describe("Strategy stats match the runs and results (D26)", () => {
  it("has one entry per strategy", () => {
    expect(mockStrategyStats.map((s) => s.strategyId).sort()).toEqual(
      mockStrategies.map((s) => s.id).sort(),
    );
  });

  it("counts, last run and result stats agree with the mocks", () => {
    for (const stats of mockStrategyStats) {
      const runs = mockBacktestRuns.filter((r) => r.strategyId === stats.strategyId);
      const done = runs.filter((r) => r.status === "completed");
      expect(stats.runsTotal).toBe(runs.length);
      expect(stats.runsCompleted).toBe(done.length);
      expect(stats.runsFailed).toBe(runs.filter((r) => r.status === "failed").length);
      expect(stats.lastRunAt).toBe(
        runs
          .map((r) => r.createdAt)
          .sort()
          .at(-1) ?? null,
      );
      const metrics = done.map((r) => ({
        runId: r.id,
        m: mockBacktestResults.find((x) => x.runId === r.id)!.metrics,
      }));
      if (metrics.length === 0) continue;
      const returns = metrics.map((x) => x.m.returnPercent);
      const winRates = metrics.map((x) => x.m.winRatePercent);
      expect(stats.bestReturnPercent).toBe(Math.max(...returns));
      expect(stats.worstReturnPercent).toBe(Math.min(...returns));
      expect(stats.winRateMinPercent).toBe(Math.min(...winRates));
      expect(stats.winRateMaxPercent).toBe(Math.max(...winRates));
      expect(stats.worstDrawdownPercent).toBe(
        Math.min(...metrics.map((x) => x.m.maxDrawdownPercent)),
      );
      const best = [...metrics].sort((a, b) => b.m.netPnlPaise - a.m.netPnlPaise)[0]!;
      expect(stats.bestNetPnl).toEqual({ runId: best.runId, netPnlPaise: best.m.netPnlPaise });
    }
  });
});

describe("Orbit consistency rules", () => {
  it("ensures run strategyVersion exists in its strategy", () => {
    for (const run of mockBacktestRuns) {
      const strategy = mockStrategies.find((s) => s.id === run.strategyId);
      expect(strategy).toBeDefined();
      const version = strategy?.versions.find((v) => v.version === run.strategyVersion);
      expect(version).toBeDefined();
    }
  });

  it("ensures queued runs have startedAt and finishedAt null", () => {
    const queuedRuns = mockBacktestRuns.filter((r) => r.status === "queued");
    expect(queuedRuns.length).toBeGreaterThan(0);
    for (const run of queuedRuns) {
      expect(run.startedAt).toBeNull();
      expect(run.finishedAt).toBeNull();
    }
  });

  it("ensures running runs have startedAt set and finishedAt null", () => {
    const runningRuns = mockBacktestRuns.filter((r) => r.status === "running");
    expect(runningRuns.length).toBeGreaterThan(0);
    for (const run of runningRuns) {
      expect(run.startedAt).not.toBeNull();
      expect(run.finishedAt).toBeNull();
    }
  });

  it("ensures completed and failed runs have both startedAt and finishedAt set", () => {
    const closedRuns = mockBacktestRuns.filter(
      (r) => r.status === "completed" || r.status === "failed",
    );
    expect(closedRuns.length).toBeGreaterThan(0);
    for (const run of closedRuns) {
      expect(run.startedAt).not.toBeNull();
      expect(run.finishedAt).not.toBeNull();
    }
  });

  it("ensures createdAt <= startedAt <= finishedAt for all runs where set", () => {
    for (const run of mockBacktestRuns) {
      const createdTs = new Date(run.createdAt).getTime();
      if (run.startedAt) {
        const startedTs = new Date(run.startedAt).getTime();
        expect(createdTs).toBeLessThanOrEqual(startedTs);
        if (run.finishedAt) {
          const finishedTs = new Date(run.finishedAt).getTime();
          expect(startedTs).toBeLessThanOrEqual(finishedTs);
        }
      }
    }
  });

  it("ensures backtest results exist only for completed runs", () => {
    const completedRunIds = mockBacktestRuns
      .filter((r) => r.status === "completed")
      .map((r) => r.id);
    expect(mockBacktestResults.length).toBe(completedRunIds.length);
    for (const result of mockBacktestResults) {
      expect(completedRunIds).toContain(result.runId);
    }
  });

  it("ensures trade runId refers to a completed run", () => {
    const completedRunIds = new Set(
      mockBacktestRuns.filter((r) => r.status === "completed").map((r) => r.id),
    );
    for (const trade of mockTrades) {
      expect(completedRunIds.has(trade.runId)).toBe(true);
    }
  });

  it("ensures trade exchange and segment match the spec of that run version", () => {
    for (const trade of mockTrades) {
      const run = mockBacktestRuns.find((r) => r.id === trade.runId);
      expect(run).toBeDefined();
      const strategy = mockStrategies.find((s) => s.id === run?.strategyId);
      const version = strategy?.versions.find((v) => v.version === run?.strategyVersion);
      expect(trade.exchange).toBe(version?.spec.exchange);
      expect(trade.segment).toBe(version?.spec.segment);
    }
  });

  it("ensures all trades are closed with exitAt and exitPricePaise provided", () => {
    for (const trade of mockTrades) {
      expect(trade.exitAt).not.toBeNull();
      expect(trade.exitPricePaise).not.toBeNull();
    }
  });

  it("ensures trade entryAt is before exitAt", () => {
    for (const trade of mockTrades) {
      expect(new Date(trade.entryAt).getTime()).toBeLessThan(
        new Date(trade.exitAt as string).getTime(),
      );
    }
  });

  it("ensures trade timestamps are within run from..to date range", () => {
    for (const trade of mockTrades) {
      const run = mockBacktestRuns.find((r) => r.id === trade.runId);
      expect(run).toBeDefined();
      const entryDate = trade.entryAt.slice(0, 10);
      const exitDate = (trade.exitAt as string).slice(0, 10);
      expect(entryDate >= (run?.from as string)).toBe(true);
      expect(entryDate <= (run?.to as string)).toBe(true);
      expect(exitDate >= (run?.from as string)).toBe(true);
      expect(exitDate <= (run?.to as string)).toBe(true);
    }
  });

  it("ensures trade entry and exit times are within NSE hours 03:45–10:00 UTC", () => {
    for (const trade of mockTrades) {
      const entryTime = trade.entryAt.slice(11, 19);
      const exitTime = (trade.exitAt as string).slice(11, 19);
      expect(entryTime >= "03:45:00").toBe(true);
      expect(entryTime <= "10:00:00").toBe(true);
      expect(exitTime >= "03:45:00").toBe(true);
      expect(exitTime <= "10:00:00").toBe(true);
    }
  });

  it("ensures intraday trades enter and exit on the same date and have dpPaise = 0", () => {
    const intradayTrades = mockTrades.filter((t) => t.segment === "equity_intraday");
    expect(intradayTrades.length).toBeGreaterThan(0);
    for (const trade of intradayTrades) {
      const entryDate = trade.entryAt.slice(0, 10);
      const exitDate = (trade.exitAt as string).slice(0, 10);
      expect(entryDate).toBe(exitDate);
      expect(trade.charges.dpPaise).toBe(0);
    }
  });

  it("ensures grossPnlPaise matches direction and quantity formula", () => {
    for (const trade of mockTrades) {
      const exitPrice = trade.exitPricePaise as number;
      const expectedGross =
        trade.side === "buy"
          ? (exitPrice - trade.entryPricePaise) * trade.qty
          : (trade.entryPricePaise - exitPrice) * trade.qty;
      expect(trade.grossPnlPaise).toBe(expectedGross);
    }
  });

  it("ensures completed runs have 4-8 trades with at least one sell and one losing trade", () => {
    const completedRuns = mockBacktestRuns.filter((r) => r.status === "completed");
    for (const run of completedRuns) {
      const runTrades = mockTrades.filter((t) => t.runId === run.id);
      expect(runTrades.length).toBeGreaterThanOrEqual(4);
      expect(runTrades.length).toBeLessThanOrEqual(8);
      expect(runTrades.some((t) => t.side === "sell")).toBe(true);
      expect(runTrades.some((t) => t.netPnlPaise < 0)).toBe(true);
    }
  });

  it("ensures backtest metrics gross, charges and net match the sum of trades", () => {
    for (const result of mockBacktestResults) {
      const runTrades = mockTrades.filter((t) => t.runId === result.runId);
      const sumGross = runTrades.reduce((acc, t) => acc + t.grossPnlPaise, 0);
      const sumCharges = runTrades.reduce((acc, t) => acc + t.charges.totalPaise, 0);
      const sumNet = runTrades.reduce((acc, t) => acc + t.netPnlPaise, 0);

      expect(result.metrics.grossPnlPaise).toBe(sumGross);
      expect(result.metrics.chargesPaise).toBe(sumCharges);
      expect(result.metrics.netPnlPaise).toBe(sumNet);
    }
  });

  it("ensures backtest metrics tradeCount, winCount, and lossCount match trade outcomes", () => {
    for (const result of mockBacktestResults) {
      const runTrades = mockTrades.filter((t) => t.runId === result.runId);
      const wins = runTrades.filter((t) => t.netPnlPaise > 0).length;
      const losses = runTrades.filter((t) => t.netPnlPaise < 0).length;

      expect(result.metrics.tradeCount).toBe(runTrades.length);
      expect(result.metrics.winCount).toBe(wins);
      expect(result.metrics.lossCount).toBe(losses);
    }
  });

  it("ensures winRatePercent and returnPercent are close to calculated values", () => {
    for (const result of mockBacktestResults) {
      const run = mockBacktestRuns.find((r) => r.id === result.runId);
      expect(run).toBeDefined();

      const expectedWinRate = (result.metrics.winCount / result.metrics.tradeCount) * 100;
      expect(result.metrics.winRatePercent).toBeCloseTo(expectedWinRate, 2);

      const expectedReturn =
        (result.metrics.netPnlPaise / (run?.initialCapitalPaise as number)) * 100;
      expect(result.metrics.returnPercent).toBeCloseTo(expectedReturn, 2);
    }
  });

  it("ensures equity curve has 10–30 points with strictly ascending dates", () => {
    for (const result of mockBacktestResults) {
      expect(result.equityCurve.length).toBeGreaterThanOrEqual(10);
      expect(result.equityCurve.length).toBeLessThanOrEqual(30);

      for (let i = 1; i < result.equityCurve.length; i++) {
        const prev = result.equityCurve[i - 1]?.date as string;
        const curr = result.equityCurve[i]?.date as string;
        expect(curr > prev).toBe(true);
      }
    }
  });

  it("ensures first equity point equals run from date with initial capital", () => {
    for (const result of mockBacktestResults) {
      const run = mockBacktestRuns.find((r) => r.id === result.runId);
      const firstPoint = result.equityCurve[0];
      expect(firstPoint?.date).toBe(run?.from);
      expect(firstPoint?.equityPaise).toBe(run?.initialCapitalPaise);
    }
  });

  it("ensures last equity point equals run to date with initial capital + net PnL", () => {
    for (const result of mockBacktestResults) {
      const run = mockBacktestRuns.find((r) => r.id === result.runId);
      const lastPoint = result.equityCurve[result.equityCurve.length - 1];
      const expectedEndEquity = (run?.initialCapitalPaise as number) + result.metrics.netPnlPaise;
      expect(lastPoint?.date).toBe(run?.to);
      expect(lastPoint?.equityPaise).toBe(expectedEndEquity);
    }
  });

  it("ensures benchmarkPaise is set iff run has benchmark, with first value = initial capital", () => {
    for (const result of mockBacktestResults) {
      const run = mockBacktestRuns.find((r) => r.id === result.runId);
      const hasBenchmark = run?.benchmark !== null;

      for (const pt of result.equityCurve) {
        if (hasBenchmark) {
          expect(pt.benchmarkPaise).not.toBeNull();
        } else {
          expect(pt.benchmarkPaise).toBeNull();
        }
      }

      if (hasBenchmark) {
        expect(result.equityCurve[0]?.benchmarkPaise).toBe(run?.initialCapitalPaise);
      }
    }
  });

  it("ensures run dates, trade dates and equity curve dates are weekdays", () => {
    const isWeekday = (date: string) => {
      const day = new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay();
      return day !== 0 && day !== 6;
    };
    const dates = [
      ...mockBacktestRuns.flatMap((r) => [r.from, r.to]),
      ...mockTrades.flatMap((t) => [t.entryAt, t.exitAt as string]),
      ...mockBacktestResults.flatMap((r) => r.equityCurve.map((p) => p.date)),
    ];
    for (const date of dates) {
      expect(isWeekday(date), date).toBe(true);
    }
  });

  it("ensures maxDrawdownPercent matches the deepest drop in the equity curve", () => {
    for (const result of mockBacktestResults) {
      let peak = 0;
      let deepest = 0;
      for (const pt of result.equityCurve) {
        peak = Math.max(peak, pt.equityPaise);
        deepest = Math.min(deepest, ((pt.equityPaise - peak) / peak) * 100);
      }
      expect(result.metrics.maxDrawdownPercent).toBeCloseTo(deepest, 2);
    }
  });
});
