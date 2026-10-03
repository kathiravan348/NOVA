import { describe, expect, it } from "vitest";
import { BacktestRunCreateSchema, BacktestVersionCreateSchema } from "./backtest";
import {
  BUYING_DEFAULTS,
  SETUP_DEFAULTS,
  StrategySpecIntradaySchema,
  type BuyingRule,
  type IntradaySetup,
} from "./intraday";
import { StrategySpecSchema } from "./strategy";
import { specParamProblems } from "./strategyWrite";

const spec = (setup: IntradaySetup, buying: BuyingRule = BUYING_DEFAULTS.single) => ({
  mode: "intraday" as const,
  segment: "equity_intraday" as const,
  exchange: "NSE" as const,
  timeframe: "1m" as const,
  setup,
  buying,
});

describe("intraday strategy spec (D84)", () => {
  it("accepts every setup and buying kind with its defaults", () => {
    for (const setup of Object.values(SETUP_DEFAULTS)) {
      for (const buying of Object.values(BUYING_DEFAULTS)) {
        const value = spec(setup, buying);
        expect(StrategySpecSchema.parse(value)).toEqual(value);
        expect(specParamProblems(StrategySpecIntradaySchema.parse(value))).toEqual([]);
      }
    }
  });

  it.each([
    ["rangeMinutes", 4],
    ["rangeMinutes", 121],
    ["retestBars", 0],
    ["retestBars", 21],
    ["retestBars", 1.5],
    ["bufferAtr", 0],
    ["bufferAtr", 5.1],
    ["targetR", 0.4],
    ["targetR", 10.5],
  ])("refuses opening range %s = %s", (field, value) => {
    const setup = { ...SETUP_DEFAULTS.opening_range_retest, [field]: value };
    expect(StrategySpecSchema.safeParse(spec(setup)).success).toBe(false);
  });

  it("refuses out-of-range buying params, a bad exit, a wrong segment and extra keys", () => {
    const bad = [
      spec(SETUP_DEFAULTS.opening_range_retest, {
        ...BUYING_DEFAULTS.average_on_recovery,
        initialPercent: 9,
      }),
      spec(SETUP_DEFAULTS.opening_range_retest, { ...BUYING_DEFAULTS.add_to_winner, triggerR: 0 }),
      spec(SETUP_DEFAULTS.opening_range_retest, {
        ...BUYING_DEFAULTS.add_to_winner,
        confirmBars: 6,
      }),
      spec(SETUP_DEFAULTS.opening_range_retest, {
        ...BUYING_DEFAULTS.average_on_recovery,
        expiryMinutes: 61,
      }),
      spec({ ...SETUP_DEFAULTS.vwap_trend_pullback, risingBars: 1 }),
      spec({ ...SETUP_DEFAULTS.failed_breakout_reclaim, exit: "close" } as never),
      { ...spec(SETUP_DEFAULTS.prev_day_high_retest), segment: "equity_delivery" },
      { ...spec(SETUP_DEFAULTS.prev_day_high_retest), timeframe: "5m" },
      { ...spec(SETUP_DEFAULTS.prev_day_high_retest), sizing: { type: "fixed_qty", qty: 1 } },
      spec({ ...SETUP_DEFAULTS.inside_bar_continuation, extra: 1 } as IntradaySetup),
      spec(SETUP_DEFAULTS.inside_bar_continuation, { kind: "single", initialPercent: 70 } as never),
    ];
    for (const value of bad) expect(StrategySpecSchema.safeParse(value).success).toBe(false);
  });
});

describe("run profile choice (D84)", () => {
  const body = {
    strategyId: "stg_006",
    strategyVersion: 1,
    name: "Opening range retest · base",
    universe: { type: "index", index: "NIFTY 100" },
    from: "2026-10-01",
    to: "2026-10-02",
    initialCapitalPaise: 100_000_000,
    benchmark: null,
    dataSource: "recorded",
  };
  const profile = { profileId: "research_001", profileVersion: 1, scenario: "stress" };

  it("takes all three of profileId, profileVersion and scenario, or none", () => {
    expect(BacktestRunCreateSchema.safeParse(body).success).toBe(true);
    expect(BacktestRunCreateSchema.safeParse({ ...body, ...profile }).success).toBe(true);
    const version = Object.fromEntries(Object.entries(body).filter(([k]) => k !== "strategyId"));
    expect(BacktestVersionCreateSchema.safeParse({ ...version, ...profile }).success).toBe(true);
    const missing = BacktestRunCreateSchema.safeParse({ ...body, profileId: "research_001" });
    expect(missing.error?.issues[0]?.message).toBe(
      "profileId, profileVersion and scenario go together",
    );
    expect(BacktestVersionCreateSchema.safeParse({ ...version, scenario: "base" }).success).toBe(
      false,
    );
    expect(
      BacktestRunCreateSchema.safeParse({ ...body, ...profile, profileVersion: 0 }).success,
    ).toBe(false);
    expect(
      BacktestRunCreateSchema.safeParse({ ...body, ...profile, scenario: "worst" }).success,
    ).toBe(false);
  });
});
