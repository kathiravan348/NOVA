import { describe, expect, it } from "vitest";
import { LibraryEntrySchema, LibraryInstallSchema, StrategyLibrarySchema } from "./library";

const entry = {
  id: "A02",
  family: "momentum_rotation",
  name: "6-month momentum",
  summary: "Each month, hold the 10 stocks with the biggest 6-month rise.",
  spec: {
    mode: "rotation",
    segment: "equity_delivery",
    exchange: "NSE",
    timeframe: "1d",
    risk: { stopLossPercent: null, targetPercent: null },
    rotation: {
      rebalance: "monthly",
      hold: 10,
      keepWithin: 20,
      score: [{ operand: { kind: "indicator", name: "roc", params: { period: 126 } }, weight: 1 }],
    },
  },
  backtest: {
    universe: { type: "index", index: "NIFTY 100" },
    from: "2021-10-01",
    to: "2024-09-30",
    initialCapitalPaise: 100_000_000,
    benchmark: "NIFTY 50",
  },
};

describe("strategy library contracts (D62 (7))", () => {
  it("accepts an entry and a library", () => {
    expect(LibraryEntrySchema.parse(entry)).toEqual(entry);
    const family = {
      id: "momentum_rotation",
      name: "A",
      idea: "Rise keeps rising.",
      watch: "Crashes.",
    };
    expect(StrategyLibrarySchema.safeParse({ families: [family], entries: [entry] }).success).toBe(
      true,
    );
  });

  it("refuses bad ids, long summaries and unknown families", () => {
    expect(LibraryEntrySchema.safeParse({ ...entry, id: "H01" }).success).toBe(false);
    expect(LibraryEntrySchema.safeParse({ ...entry, summary: "x".repeat(141) }).success).toBe(
      false,
    );
    expect(LibraryEntrySchema.safeParse({ ...entry, family: "other" }).success).toBe(false);
  });

  it("installs 1–100 distinct ids", () => {
    expect(LibraryInstallSchema.safeParse({ ids: ["A01", "B02"] }).success).toBe(true);
    expect(LibraryInstallSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(LibraryInstallSchema.safeParse({ ids: ["A01", "A01"] }).success).toBe(false);
    expect(LibraryInstallSchema.safeParse({ ids: ["a01"] }).success).toBe(false);
  });
});
