import { describe, expect, it } from "vitest";
import {
  BacktestMetrics,
  BacktestMetricsSchema,
  BacktestResult,
  BacktestResultSchema,
  BacktestRun,
  BacktestRunSchema,
  EquityPoint,
  EquityPointSchema,
} from "./backtest";

describe("Backtest schemas", () => {
  const validRun: BacktestRun = {
    id: "run-001",
    strategyId: "strat-001",
    strategyVersion: 1,
    name: "NIFTY 50 1-Year Backtest",
    universe: { type: "index", index: "NIFTY 50" },
    status: "completed",
    from: "2025-01-01",
    to: "2025-12-31",
    initialCapitalPaise: 100000000,
    benchmark: "NIFTY 50",
    createdAt: "2026-01-01T00:00:00Z",
    startedAt: "2026-01-01T00:01:00Z",
    finishedAt: "2026-01-01T00:05:00Z",
    error: null,
  };

  const validMetrics: BacktestMetrics = {
    grossPnlPaise: 15000000,
    chargesPaise: 850000,
    netPnlPaise: 14150000, // 15000000 - 850000
    returnPercent: 14.15,
    cagrPercent: 14.15,
    maxDrawdownPercent: -5.42,
    sharpe: 1.85,
    winRatePercent: 62.5,
    tradeCount: 80,
    winCount: 50,
    lossCount: 30,
  };

  const validEquityPoint: EquityPoint = {
    date: "2025-06-30",
    equityPaise: 107500000,
    benchmarkPaise: 105000000,
  };

  const validResult: BacktestResult = {
    runId: "run-001",
    metrics: validMetrics,
    equityCurve: [validEquityPoint],
    bySymbol: [
      {
        symbol: "TCS",
        tradeCount: 4,
        winCount: 3,
        lossCount: 1,
        winRatePercent: 75,
        netPnlPaise: 120000,
      },
    ],
  };

  describe("BacktestRunSchema", () => {
    it("accepts a valid completed run", () => {
      expect(BacktestRunSchema.safeParse(validRun).success).toBe(true);
    });

    it("accepts a valid failed run with error message", () => {
      const failedRun: BacktestRun = {
        ...validRun,
        status: "failed",
        error: "Insufficient historical data for symbol",
      };
      expect(BacktestRunSchema.safeParse(failedRun).success).toBe(true);
    });

    it("requires a universe with at least one symbol", () => {
      const noUniverse: Partial<BacktestRun> = { ...validRun };
      delete noUniverse.universe;
      expect(BacktestRunSchema.safeParse(noUniverse).success).toBe(false);
      expect(
        BacktestRunSchema.safeParse({ ...validRun, universe: { type: "symbols", symbols: [] } })
          .success,
      ).toBe(false);
      expect(
        BacktestRunSchema.safeParse({
          ...validRun,
          universe: { type: "symbols", symbols: ["TCS", "INFY"] },
        }).success,
      ).toBe(true);
    });

    it("rejects when from date is after to date", () => {
      const invalid = { ...validRun, from: "2026-01-01", to: "2025-01-01" };
      expect(BacktestRunSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects error when status is not failed", () => {
      const invalid = { ...validRun, status: "completed", error: "Something went wrong" };
      expect(BacktestRunSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects an invalid status enum", () => {
      const invalid = { ...validRun, status: "cancelled" };
      expect(BacktestRunSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects an invalid benchmark name", () => {
      const invalid = { ...validRun, benchmark: "S&P 500" };
      expect(BacktestRunSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("BacktestMetricsSchema", () => {
    it("accepts valid metrics", () => {
      expect(BacktestMetricsSchema.safeParse(validMetrics).success).toBe(true);
    });

    it("rejects when netPnlPaise does not equal grossPnlPaise - chargesPaise", () => {
      const invalid = { ...validMetrics, netPnlPaise: 14000000 };
      expect(BacktestMetricsSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects when winCount + lossCount > tradeCount", () => {
      const invalid = { ...validMetrics, winCount: 50, lossCount: 35, tradeCount: 80 };
      expect(BacktestMetricsSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects positive maxDrawdownPercent", () => {
      const invalid = { ...validMetrics, maxDrawdownPercent: 1.5 };
      expect(BacktestMetricsSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects winRatePercent outside 0-100", () => {
      expect(
        BacktestMetricsSchema.safeParse({ ...validMetrics, winRatePercent: 105 }).success,
      ).toBe(false);
      expect(BacktestMetricsSchema.safeParse({ ...validMetrics, winRatePercent: -2 }).success).toBe(
        false,
      );
    });
  });

  describe("EquityPointSchema", () => {
    it("accepts a valid equity point", () => {
      expect(EquityPointSchema.safeParse(validEquityPoint).success).toBe(true);
    });

    it("accepts null benchmarkPaise", () => {
      expect(
        EquityPointSchema.safeParse({ ...validEquityPoint, benchmarkPaise: null }).success,
      ).toBe(true);
    });
  });

  describe("BacktestResultSchema", () => {
    it("accepts a valid backtest result", () => {
      expect(BacktestResultSchema.safeParse(validResult).success).toBe(true);
    });

    it("rejects duplicate symbols and wins + losses above trades", () => {
      const row = validResult.bySymbol[0]!;
      expect(BacktestResultSchema.safeParse({ ...validResult, bySymbol: [row, row] }).success).toBe(
        false,
      );
      expect(
        BacktestResultSchema.safeParse({
          ...validResult,
          bySymbol: [{ ...row, winCount: 4 }],
        }).success,
      ).toBe(false);
    });
  });
});
