import { describe, expect, it } from "vitest";
import { CoverageDetailSchema, CoverageListSchema, CoverageRowSchema } from "./coverage";

const row = {
  symbol: "INFY",
  name: "Infosys",
  kind: "stock",
  sector: "Information Technology",
  indices: ["NIFTY 50"],
  firstDay: "2021-01-01",
  lastDay: "2026-09-18",
  days: 1200,
  missingDays: 0,
  status: "complete",
} as const;

describe("coverage (D63)", () => {
  it("accepts a complete row and a stock with nothing stored", () => {
    expect(CoverageRowSchema.safeParse(row).success).toBe(true);
    const none = { ...row, firstDay: null, lastDay: null, days: 0, status: "none" };
    expect(CoverageRowSchema.safeParse(none).success).toBe(true);
  });

  it("refuses rows whose status disagrees with their numbers", () => {
    for (const bad of [
      { ...row, status: "none" },
      { ...row, days: 0 },
      { ...row, missingDays: 3 },
      { ...row, firstDay: null },
      { ...row, status: "unknown" },
    ]) {
      expect(CoverageRowSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("checks the list period and that missing ranges add up", () => {
    const list = {
      timeframe: "1d",
      from: "2021-09-18",
      to: "2026-09-18",
      calendar: "index",
      rows: [row],
    };
    expect(CoverageListSchema.safeParse(list).success).toBe(true);
    expect(CoverageListSchema.safeParse({ ...list, from: "2027-01-01" }).success).toBe(false);
    expect(CoverageListSchema.safeParse({ ...list, timeframe: "5m" }).success).toBe(false);

    const detail = {
      symbol: "INFY",
      timeframe: "1m",
      from: "2026-06-29",
      to: "2026-09-18",
      firstDay: "2026-06-29",
      lastDay: "2026-09-18",
      days: 57,
      missingDays: 3,
      missing: [
        { from: "2026-07-06", to: "2026-07-06", days: 1 },
        { from: "2026-07-20", to: "2026-07-21", days: 2 },
      ],
    };
    expect(CoverageDetailSchema.safeParse(detail).success).toBe(true);
    expect(CoverageDetailSchema.safeParse({ ...detail, missingDays: 4 }).success).toBe(false);
  });
});
