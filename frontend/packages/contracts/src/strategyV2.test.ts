import { describe, expect, it } from "vitest";
import {
  PortfolioSchema,
  RiskSchema,
  RotationSchema,
  StrategySpecSchema,
  type StrategySpecRotation,
  type StrategySpecVisual,
} from "./strategy";
import { StrategyCreateSchema, specParamProblems } from "./strategyWrite";

const roc = { kind: "indicator", name: "roc", params: { period: 126 } } as const;
const close = { kind: "price", field: "close" } as const;
const sma200 = { kind: "indicator", name: "sma", params: { period: 200 } } as const;
const regime = {
  index: "NIFTY 50",
  condition: { left: close, op: "gt", right: sma200 },
  whenOff: "exit_all",
} as const;

const rotation: StrategySpecRotation = {
  mode: "rotation",
  segment: "equity_delivery",
  exchange: "NSE",
  timeframe: "1d",
  risk: { stopLossPercent: null, targetPercent: null },
  regime,
  rotation: {
    rebalance: "monthly",
    hold: 10,
    keepWithin: 20,
    score: [{ operand: roc, weight: 1 }],
  },
};

const visual: StrategySpecVisual = {
  mode: "visual",
  segment: "equity_delivery",
  exchange: "NSE",
  timeframe: "1d",
  sizing: { type: "percent_equity", percent: 10 },
  risk: {
    stopLossPercent: 10,
    targetPercent: null,
    trailingStopPercent: 15,
    atrStop: { period: 20, multiplier: 3 },
    maxHoldBars: 60,
  },
  portfolio: { maxPositions: 10, rank: { by: roc, order: "desc" } },
  regime: { ...regime, whenOff: "no_new_entries" },
  entry: {
    combinator: "all",
    conditions: [
      { left: { ...close, field: "volume" }, op: "gt", right: { ...sma200, multiplier: 1.5 } },
    ],
  },
  exit: { combinator: "any", conditions: [{ left: close, op: "lt", right: sma200 }] },
};

const create = (spec: unknown) =>
  StrategyCreateSchema.safeParse({ name: "S", description: "", spec });

describe("spec v2 (D62)", () => {
  it("accepts every new field and a rotation spec", () => {
    expect(StrategySpecSchema.parse(visual)).toEqual(visual);
    expect(StrategySpecSchema.parse(rotation)).toEqual(rotation);
    expect(create(visual).success).toBe(true);
    expect(create(rotation).success).toBe(true);
  });

  it("checks the new risk fields and the portfolio", () => {
    expect(RiskSchema.safeParse({ ...visual.risk, trailingStopPercent: 51 }).success).toBe(false);
    expect(RiskSchema.safeParse({ ...visual.risk, maxHoldBars: 0 }).success).toBe(false);
    expect(
      RiskSchema.safeParse({ ...visual.risk, atrStop: { period: 0, multiplier: 3 } }).success,
    ).toBe(false);
    expect(PortfolioSchema.safeParse({ maxPositions: 101 }).success).toBe(false);
    const numberRank = {
      maxPositions: 5,
      rank: { by: { kind: "number", value: 1 }, order: "asc" },
    };
    expect(PortfolioSchema.safeParse(numberRank).success).toBe(false);
  });

  it("refuses bad rotations", () => {
    const base = rotation.rotation;
    const bad = [
      { ...base, keepWithin: 5 },
      { ...base, score: [] },
      { ...base, score: [...base.score, ...base.score, ...base.score, ...base.score] },
      { ...base, score: [{ operand: roc, weight: 0 }] },
      { ...base, score: [{ operand: { kind: "number", value: 3 }, weight: 1 }] },
    ];
    for (const r of bad) expect(RotationSchema.safeParse(r).success).toBe(false);
    expect(StrategySpecSchema.safeParse({ ...rotation, timeframe: "15m" }).success).toBe(false);
    expect(StrategySpecSchema.safeParse({ ...rotation, sizing: visual.sizing }).success).toBe(
      false,
    );
  });

  it("refuses a multiplier of 0 or below", () => {
    const zero = {
      ...visual,
      exit: {
        ...visual.exit,
        conditions: [{ left: close, op: "lt", right: { ...sma200, multiplier: 0 } }],
      },
    };
    expect(StrategySpecSchema.safeParse(zero).success).toBe(false);
  });

  it("checks indicator settings in rank, market filter, score and filter", () => {
    const badSma = { kind: "indicator", name: "sma", params: { period: 0 } } as const;
    const inRank = {
      ...visual,
      portfolio: { maxPositions: 5, rank: { by: badSma, order: "asc" } },
    };
    const inRegime = {
      ...visual,
      regime: { ...regime, condition: { ...regime.condition, right: badSma } },
    };
    const inScore = {
      ...rotation,
      rotation: { ...rotation.rotation, score: [{ operand: badSma, weight: 1 }] },
    };
    const inFilter = {
      ...rotation,
      rotation: {
        ...rotation.rotation,
        filter: { combinator: "all", conditions: [{ left: close, op: "gt", right: badSma }] },
      },
    };
    for (const spec of [inRank, inRegime, inScore, inFilter]) {
      expect(create(spec).success).toBe(false);
    }
    expect(specParamProblems(StrategySpecSchema.parse(inScore))).toEqual([
      "SMA period must be a whole number of at least 1",
    ]);
  });

  it("refuses an opening range on daily bars (D62 (5))", () => {
    const orHigh = { kind: "indicator", name: "or_high", params: { minutes: 15 } } as const;
    const entry = { combinator: "all", conditions: [{ left: close, op: "gt", right: orHigh }] };
    const daily = { ...visual, entry } as const;
    expect(specParamProblems(StrategySpecSchema.parse(daily))).toEqual([
      "Opening range needs an intraday timeframe",
    ]);
    expect(create(daily).success).toBe(false);
    const intraday = { ...daily, segment: "equity_intraday", timeframe: "15m" } as const;
    expect(create(intraday).success).toBe(true);
  });
});
