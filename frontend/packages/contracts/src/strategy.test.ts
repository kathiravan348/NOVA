import { describe, expect, it } from "vitest";
import {
  AveragingSchema,
  ConditionSchema,
  OperandSchema,
  RuleGroupSchema,
  SizingSchema,
  Strategy,
  StrategyCreateSchema,
  StrategySchema,
  StrategySpecPython,
  StrategySpecPythonSchema,
  StrategySpecVisual,
  StrategySpecVisualSchema,
  StrategyUpdateSchema,
  StrategyVersionCreateSchema,
  UniverseSchema,
} from "./strategy";

describe("Strategy schemas", () => {
  const visualSpec: StrategySpecVisual = {
    mode: "visual",
    segment: "equity_delivery",
    exchange: "NSE",
    timeframe: "15m",
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

describe("strategy write bodies (D43)", () => {
  const spec = {
    mode: "python" as const,
    segment: "equity_delivery" as const,
    exchange: "NSE" as const,
    timeframe: "1d" as const,
    sizing: { type: "fixed_qty" as const, qty: 10 },
    risk: { stopLossPercent: null, targetPercent: null },
    code: "class Strategy: ...",
  };

  it("accepts a create and a new version", () => {
    expect(StrategyCreateSchema.safeParse({ name: "S", description: "", spec }).success).toBe(true);
    expect(StrategyVersionCreateSchema.safeParse({ note: "v2", spec }).success).toBe(true);
  });

  it("rejects a create without a name or with extra fields", () => {
    expect(StrategyCreateSchema.safeParse({ name: "", description: "", spec }).success).toBe(false);
    expect(
      StrategyCreateSchema.safeParse({ name: "S", description: "", spec, status: "active" })
        .success,
    ).toBe(false);
  });

  it("needs at least one known field in an update", () => {
    expect(StrategyUpdateSchema.safeParse({ status: "archived" }).success).toBe(true);
    expect(StrategyUpdateSchema.safeParse({}).success).toBe(false);
    expect(StrategyUpdateSchema.safeParse({ status: "deleted" }).success).toBe(false);
  });
});

describe("indicator params and offset (D51)", () => {
  const withEntry = (left: Record<string, unknown>) => ({
    mode: "visual",
    segment: "equity_delivery",
    exchange: "NSE",
    timeframe: "1d",
    sizing: { type: "fixed_qty", qty: 1 },
    risk: { stopLossPercent: null, targetPercent: null },
    entry: {
      combinator: "all",
      conditions: [{ left, op: "gt", right: { kind: "number", value: 0 } }],
    },
    exit: {
      combinator: "all",
      conditions: [
        { left: { kind: "price", field: "close" }, op: "lt", right: { kind: "number", value: 1 } },
      ],
    },
  });
  const create = (left: Record<string, unknown>) =>
    StrategyCreateSchema.safeParse({ name: "S", description: "", spec: withEntry(left) }).success;

  it("refuses bad indicator params on write but still reads them", () => {
    const macd = { kind: "indicator", name: "macd", params: { period: 20 } };
    const rsi = { kind: "indicator", name: "rsi", params: { period: 2.5 } };
    expect(create(macd)).toBe(false);
    expect(create(rsi)).toBe(false);
    expect(StrategyVersionCreateSchema.safeParse({ note: "", spec: withEntry(macd) }).success).toBe(
      false,
    );
    expect(StrategySpecVisualSchema.safeParse(withEntry(macd)).success).toBe(true);
    expect(create({ kind: "indicator", name: "macd", params: { fast: 12, slow: 26 } })).toBe(true);
  });

  it("accepts offset 0–500 or absent, refuses −1, 501 and 1.5", () => {
    for (const offset of [0, 1, 500, undefined]) {
      expect(OperandSchema.safeParse({ kind: "price", field: "high", offset }).success).toBe(true);
      expect(
        OperandSchema.safeParse({ kind: "indicator", name: "sma", params: {}, offset }).success,
      ).toBe(true);
    }
    for (const offset of [-1, 501, 1.5]) {
      expect(OperandSchema.safeParse({ kind: "price", field: "high", offset }).success).toBe(false);
      expect(
        OperandSchema.safeParse({ kind: "indicator", name: "sma", params: {}, offset }).success,
      ).toBe(false);
    }
  });
});

describe("AveragingSchema (D53)", () => {
  it("accepts a drop up to 50% and 1–10 whole adds", () => {
    expect(AveragingSchema.safeParse({ dropPercent: 5, maxAdds: 3 }).success).toBe(true);
    expect(AveragingSchema.safeParse({ dropPercent: 50, maxAdds: 10 }).success).toBe(true);
    for (const bad of [
      { dropPercent: 0, maxAdds: 3 },
      { dropPercent: 51, maxAdds: 3 },
      { dropPercent: 5, maxAdds: 0 },
      { dropPercent: 5, maxAdds: 11 },
      { dropPercent: 5, maxAdds: 1.5 },
    ]) {
      expect(AveragingSchema.safeParse(bad).success).toBe(false);
    }
  });
});
