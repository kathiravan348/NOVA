import { describe, expect, it } from "vitest";
import { mockStrategies, mockStrategyStats } from "@nova/mocks";
import {
  EMPTY_FILTERS,
  filterStrategies,
  fromQuery,
  hasFilters,
  hasMoreFilters,
  sortStrategies,
  toQuery,
} from "./strategyFilters";

const statsById = new Map(mockStrategyStats.map((stats) => [stats.strategyId, stats]));
describe("strategy filters", () => {
  it("combines case-insensitive name, status and latest-version spec filters", () => {
    const strategy = mockStrategies[0]!;
    const spec = strategy.versions.find(
      (version) => version.version === strategy.latestVersion,
    )!.spec;
    const values = {
      ...EMPTY_FILTERS,
      q: strategy.name.toUpperCase(),
      status: strategy.status,
      mode: spec.mode,
      segment: spec.segment,
      timeframe: spec.timeframe,
    };
    expect(
      filterStrategies(mockStrategies, statsById, values).map((strategy) => strategy.id),
    ).toEqual([strategy.id]);
    expect(filterStrategies(mockStrategies, statsById, { ...values, q: "unknown" })).toEqual([]);
  });

  it("uses completed runs in the chosen stats for Tested and minimum CAGR", () => {
    const strategy = mockStrategies[0]!;
    const tested = { ...EMPTY_FILTERS, tested: "tested" as const, minBestCagr: "10" };
    expect(filterStrategies([strategy], statsById, tested)).toEqual([strategy]);
    expect(filterStrategies([strategy], new Map(), tested)).toEqual([]);
    expect(filterStrategies([strategy], statsById, { ...tested, minBestCagr: "100" })).toEqual([]);
    expect(
      filterStrategies([strategy], new Map(), { ...EMPTY_FILTERS, tested: "untested" }),
    ).toEqual([strategy]);
    expect(
      filterStrategies([strategy], statsById, { ...EMPTY_FILTERS, minBestCagr: "invalid" }),
    ).toEqual([strategy]);
  });

  it("round-trips every filter and seconds timeframes through the URL", () => {
    const values = {
      ...EMPTY_FILTERS,
      q: "breakout",
      status: "active" as const,
      dataSource: "recorded" as const,
      sort: "name" as const,
      mode: "visual" as const,
      segment: "equity_intraday" as const,
      timeframe: "5s" as const,
      tested: "tested" as const,
      minBestCagr: "25",
    };
    expect(fromQuery(toQuery(values))).toEqual(values);
    expect(hasFilters(values)).toBe(true);
    expect(hasMoreFilters(values)).toBe(true);
    expect(toQuery(EMPTY_FILTERS).toString()).toBe("");
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("drops invalid enum and numeric URL values", () => {
    expect(
      fromQuery(
        new URLSearchParams(
          "status=bad&mode=bad&segment=bad&timeframe=bad&dataSource=bad&sort=bad&tested=bad&minBestCagr=Infinity",
        ),
      ),
    ).toEqual(EMPTY_FILTERS);
    expect(toQuery({ ...EMPTY_FILTERS, minBestCagr: "NaN" }).has("minBestCagr")).toBe(false);
    expect(hasMoreFilters({ ...EMPTY_FILTERS, sort: "name" })).toBe(false);
  });

  it("sorts names A–Z without mutating the input", () => {
    const list = mockStrategies
      .slice(0, 3)
      .map((strategy, i) => ({ ...strategy, name: ["Zulu", "alpha", "Bravo"][i]! }));
    expect(sortStrategies(list, statsById, "name").map((strategy) => strategy.name)).toEqual([
      "alpha",
      "Bravo",
      "Zulu",
    ]);
    expect(list[0]!.name).toBe("Zulu");
  });

  it("sorts net profit and least severe drawdown, keeping missing results last", () => {
    const [a, b, c] = mockStrategies;
    const base = mockStrategyStats[0]!;
    const map = new Map([
      [
        a!.id,
        { ...base, bestNetPnl: { runId: "run_a", netPnlPaise: 100 }, worstDrawdownPercent: -20 },
      ],
      [
        b!.id,
        {
          ...base,
          strategyId: b!.id,
          bestNetPnl: { runId: "run_b", netPnlPaise: 200 },
          worstDrawdownPercent: -5,
        },
      ],
    ]);
    for (const sort of ["net", "drawdown"] as const) {
      expect(sortStrategies([c!, a!, b!], map, sort).map((strategy) => strategy.id)).toEqual([
        b!.id,
        a!.id,
        c!.id,
      ]);
    }
  });
});
