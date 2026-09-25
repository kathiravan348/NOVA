import { describe, expect, it } from "vitest";
import { INDICATORS, IndicatorNameSchema, checkIndicatorParams, indicatorDef } from "./indicators";

describe("indicator catalog (D51)", () => {
  it("has 38 unique indicators in five groups", () => {
    expect(INDICATORS).toHaveLength(38);
    expect(new Set(INDICATORS.map((i) => i.name)).size).toBe(38);
    expect(new Set(INDICATORS.map((i) => i.group))).toEqual(
      new Set(["trend", "momentum", "volatility", "volume", "levels"]),
    );
    expect(IndicatorNameSchema.options).toEqual(INDICATORS.map((i) => i.name));
  });

  it("accepts every indicator's own defaults", () => {
    for (const i of INDICATORS) {
      const params = Object.fromEntries(i.params.map((p) => [p.key, p.default]));
      expect(checkIndicatorParams(i.name, params)).toEqual([]);
      expect(checkIndicatorParams(i.name, {})).toEqual([]);
    }
  });

  it("reports unknown keys, bad numbers and fast ≥ slow", () => {
    expect(checkIndicatorParams("macd", { period: 20 })).toEqual([
      "Unknown setting 'period' for MACD line",
    ]);
    expect(checkIndicatorParams("rsi", { period: 2.5 })).toHaveLength(1);
    expect(checkIndicatorParams("rsi", { period: 0 })).toHaveLength(1);
    expect(checkIndicatorParams("psar", { step: 0 })).toHaveLength(1);
    expect(checkIndicatorParams("psar", { step: 0.5 })).toEqual([]);
    expect(checkIndicatorParams("macd", { fast: 30 })).toEqual([
      "MACD line fast must be less than slow",
    ]);
    expect(checkIndicatorParams("nope", {})).toEqual(["Unknown indicator 'nope'"]);
    expect(indicatorDef("pivot_r1")?.label).toBe("Pivot R1");
  });
});
