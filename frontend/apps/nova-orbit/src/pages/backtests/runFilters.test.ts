import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  fromParams,
  hasFilters,
  hasMoreFilters,
  numberValue,
  toParams,
  toQuery,
} from "./runFilters";

describe("backtest filter values", () => {
  it("restores filters and sorting from the URL", () => {
    const values = fromParams(
      new URLSearchParams(
        "source=recorded&minCagr=10&sort=cagr&order=asc&timeframe=5s&profitable=true",
      ),
    );
    expect(values).toMatchObject({
      minCagr: "10",
      sort: "cagr",
      ascending: true,
      timeframe: "5s",
      profitable: true,
    });
    expect(toQuery(values)).toEqual({
      minCagr: 10,
      sort: "cagr",
      order: "asc",
      timeframe: "5s",
      profitable: true,
    });
    expect(toParams(values, { source: "recorded" }).get("source")).toBe("recorded");
    expect(hasMoreFilters(values)).toBe(true);
  });

  it("drops unknown and invalid values", () => {
    const values = fromParams(
      new URLSearchParams(
        "status=bad&segment=bad&timeframe=bad&sort=bad&minCagr=NaN&maxDrawdown=-1&minTrades=1.5&minWinRate=101&minProfitFactor=Infinity&unknown=yes",
      ),
    );
    expect(values).toEqual(EMPTY_FILTERS);
    expect(toParams(values, { source: "history" }).toString()).toBe("source=history");
  });

  it("keeps zeroes and negative return thresholds", () => {
    const values = { ...EMPTY_FILTERS, minReturn: "-2.5", minTrades: "0", minProfitFactor: "0" };
    expect(toQuery(values)).toEqual({ minReturn: -2.5, minTrades: 0, minProfitFactor: 0 });
    expect(toParams(values).get("minTrades")).toBe("0");
    expect(hasFilters(values)).toBe(true);
  });

  it("does not send invalid typed numbers and caps searches", () => {
    expect(numberValue("minTrades", "2.3")).toBeUndefined();
    expect(numberValue("maxDrawdown", "101")).toBeUndefined();
    expect(numberValue("minCagr", " ")).toBeUndefined();
    const values = { ...EMPTY_FILTERS, minTrades: "2.3", minWinRate: "-1" };
    expect(toQuery(values)).toEqual({});
    expect(toParams(values).toString()).toBe("");
    expect(fromParams(new URLSearchParams({ q: "a".repeat(201) })).q).toHaveLength(200);
  });

  it("clears sorting as well as filters and keeps only the source", () => {
    expect(hasFilters({ ...EMPTY_FILTERS, sort: "cagr" })).toBe(true);
    expect(toParams(EMPTY_FILTERS, { source: "recorded" }).toString()).toBe("source=recorded");
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
  });
});
