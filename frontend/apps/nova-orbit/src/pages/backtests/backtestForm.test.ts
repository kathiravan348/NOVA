import { describe, expect, it } from "vitest";
import { mockStrategies } from "@nova/mocks";
import { BacktestFormSchema, defaultsFor, todayIst, type BacktestForm } from "./backtestForm";
import { formatPeriod } from "../../lib/format";

const issues = (form: BacktestForm) => {
  const r = BacktestFormSchema.safeParse(form);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("backtestForm", () => {
  const valid = defaultsFor(mockStrategies[0], "2026-09-21");

  it("builds defaults from a strategy", () => {
    expect(valid).toMatchObject({
      strategyId: "stg_001",
      version: "2",
      name: "VWAP Momentum Intraday backtest",
      from: "2026-06-21",
      to: "2026-09-21",
      capitalRupees: "1000000",
      benchmark: true,
    });
    expect(issues(valid)).toEqual([]);
  });

  it("requires strategy, version and name", () => {
    expect(issues(defaultsFor(undefined, "2026-09-21"))).toEqual([
      "strategyId: Choose a strategy",
      "version: Choose a version",
      "name: Name is required",
    ]);
  });

  it("checks the date range and capital", () => {
    expect(issues({ ...valid, from: "2026-09-22", to: "2026-09-21" })).toEqual([
      "from: Start must be on or before end",
    ]);
    expect(issues({ ...valid, to: "2999-01-01" })).toEqual(["to: End can't be in the future"]);
    expect(issues({ ...valid, capitalRupees: "9999" })).toEqual([
      "capitalRupees: At least ₹10,000",
    ]);
    expect(issues({ ...valid, capitalRupees: "" })).toEqual(["capitalRupees: At least ₹10,000"]);
  });

  it("formats today and periods", () => {
    expect(todayIst(new Date("2026-09-21T20:00:00Z"))).toBe("2026-09-22");
    expect(formatPeriod("2026-06-01", "2026-06-15")).toBe("1 Jun – 15 Jun 2026");
    expect(formatPeriod("2025-12-01", "2026-01-15")).toBe("1 Dec 2025 – 15 Jan 2026");
  });
});
