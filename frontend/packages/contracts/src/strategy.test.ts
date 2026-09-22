import { describe, expect, it } from "vitest";
import {
  ConditionSchema,
  OperandSchema,
  RuleGroupSchema,
  SizingSchema,
  Strategy,
  StrategySchema,
  StrategySpecPython,
  StrategySpecPythonSchema,
  StrategySpecVisual,
  StrategySpecVisualSchema,
  UniverseSchema,
} from "./strategy";

describe("Strategy schemas", () => {
  const visualSpec: StrategySpecVisual = {
    mode: "visual",
    segment: "equity_delivery",
    exchange: "NSE",
    timeframe: "15m",
    universe: {
      type: "symbols",
      symbols: ["RELIANCE", "TCS"],
    },
    sizing: {
      type: "percent_equity",
      percent: 10,
    },
    risk: {
      stopLossPercent: 1.5,
      targetPercent: 3.0,
    },
    entry: {
      combinator: "all",
      conditions: [
        {
          left: { kind: "indicator", name: "rsi", params: { period: 14 } },
          op: "lt",
          right: { kind: "number", value: 30 },
        },
      ],
    },
    exit: {
      combinator: "any",
      conditions: [
        {
          left: { kind: "indicator", name: "rsi", params: { period: 14 } },
          op: "gt",
          right: { kind: "number", value: 70 },
        },
      ],
    },
  };

  const validStrategy: Strategy = {
    id: "strat-001",
    name: "RSI Mean Reversion",
    description: "Buys oversold RSI, exits overbought",
    status: "active",
    latestVersion: 2,
    versions: [
      {
        version: 1,
        createdAt: "2026-09-20T10:00:00Z",
        note: "Initial visual version",
        spec: visualSpec,
      },
      {
        version: 2,
        createdAt: "2026-09-22T10:00:00Z",
        note: "Updated RSI bounds",
        spec: visualSpec,
      },
    ],
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-22T10:00:00Z",
  };

  it("validates OperandSchema", () => {
    expect(OperandSchema.safeParse({ kind: "price", field: "close" }).success).toBe(true);
    expect(
      OperandSchema.safeParse({ kind: "indicator", name: "ema", params: { period: 20 } }).success,
    ).toBe(true);
    expect(OperandSchema.safeParse({ kind: "number", value: 42 }).success).toBe(true);
    expect(OperandSchema.safeParse({ kind: "unknown", value: 1 }).success).toBe(false);
  });

  it("validates ConditionSchema and rejects wrong op enum", () => {
    expect(
      ConditionSchema.safeParse({
        left: { kind: "price", field: "close" },
        op: "crosses_above",
        right: { kind: "indicator", name: "sma", params: { period: 50 } },
      }).success,
    ).toBe(true);
    expect(
      ConditionSchema.safeParse({
        left: { kind: "price", field: "close" },
        op: "unknown_op",
        right: { kind: "number", value: 100 },
      }).success,
    ).toBe(false);
  });

  it("validates RuleGroupSchema and rejects empty conditions", () => {
    expect(
      RuleGroupSchema.safeParse({
        combinator: "all",
        conditions: [
          {
            left: { kind: "price", field: "close" },
            op: "gt",
            right: { kind: "number", value: 100 },
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      RuleGroupSchema.safeParse({
        combinator: "all",
        conditions: [],
      }).success,
    ).toBe(false);
  });

  it("validates UniverseSchema index and symbols", () => {
    expect(UniverseSchema.safeParse({ type: "index", index: "NIFTY 50" }).success).toBe(true);
    expect(UniverseSchema.safeParse({ type: "symbols", symbols: ["INFY"] }).success).toBe(true);
    expect(UniverseSchema.safeParse({ type: "symbols", symbols: [] }).success).toBe(false);
    expect(UniverseSchema.safeParse({ type: "index", index: "DOW JONES" }).success).toBe(false);
  });

  it("validates SizingSchema options and boundaries", () => {
    expect(SizingSchema.safeParse({ type: "fixed_qty", qty: 10 }).success).toBe(true);
    expect(SizingSchema.safeParse({ type: "fixed_amount", amountPaise: 500000 }).success).toBe(
      true,
    );
    expect(SizingSchema.safeParse({ type: "percent_equity", percent: 25 }).success).toBe(true);
    expect(SizingSchema.safeParse({ type: "percent_equity", percent: 0 }).success).toBe(false);
    expect(SizingSchema.safeParse({ type: "percent_equity", percent: 100.1 }).success).toBe(false);
  });

  it("validates python StrategySpec", () => {
    const pythonSpec: StrategySpecPython = {
      mode: "python",
      segment: "futures",
      exchange: "NFO",
      timeframe: "5m",
      universe: { type: "index", index: "NIFTY BANK" },
      sizing: { type: "fixed_qty", qty: 25 },
      risk: { stopLossPercent: null, targetPercent: null },
      code: "class MyStrategy:\n    pass\n",
    };
    expect(StrategySpecPythonSchema.safeParse(pythonSpec).success).toBe(true);
    expect(StrategySpecVisualSchema.safeParse(pythonSpec).success).toBe(false);
  });

  it("accepts a valid strategy with correct latestVersion", () => {
    expect(StrategySchema.safeParse(validStrategy).success).toBe(true);
  });

  it("rejects when latestVersion does not equal max version in versions array", () => {
    const invalid = { ...validStrategy, latestVersion: 1 };
    expect(StrategySchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an invalid strategy status enum", () => {
    const invalid = { ...validStrategy, status: "deleted" };
    expect(StrategySchema.safeParse(invalid).success).toBe(false);
  });
});
