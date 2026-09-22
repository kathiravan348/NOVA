import { describe, expect, it } from "vitest";
import { fromZonedInputValue, toZonedInputValue } from "./zonedTime";

describe("zonedTime", () => {
  it("converts UTC ISO to IST local input value and back (2026-09-21T06:30:00Z <-> 2026-09-21T12:00)", () => {
    const utcIso = "2026-09-21T06:30:00Z";
    const local = toZonedInputValue(utcIso, "Asia/Kolkata");
    expect(local).toBe("2026-09-21T12:00");

    const backToUtc = fromZonedInputValue(local, "Asia/Kolkata");
    expect(backToUtc).toBe(utcIso);
  });

  it("handles dates crossing midnight", () => {
    // 2026-09-20 20:00:00 UTC + 5:30 = 2026-09-21 01:30:00 IST
    const utcMidnightCross = "2026-09-20T20:00:00Z";
    const local = toZonedInputValue(utcMidnightCross, "Asia/Kolkata");
    expect(local).toBe("2026-09-21T01:30");

    const backToUtc = fromZonedInputValue(local, "Asia/Kolkata");
    expect(backToUtc).toBe(utcMidnightCross);
  });

  it("round trips arbitrary timezones and times", () => {
    const originalUtc = "2026-12-31T23:45:00Z";
    const newYorkLocal = toZonedInputValue(originalUtc, "America/New_York");
    // New York is EST (UTC-5): 2026-12-31T18:45
    expect(newYorkLocal).toBe("2026-12-31T18:45");

    const convertedUtc = fromZonedInputValue(newYorkLocal, "America/New_York");
    expect(convertedUtc).toBe(originalUtc);
  });

  it("handles empty and invalid inputs gracefully", () => {
    expect(toZonedInputValue("")).toBe("");
    expect(fromZonedInputValue("")).toBe("");
    expect(toZonedInputValue("invalid-date")).toBe("");
    expect(fromZonedInputValue("invalid-date")).toBe("");
  });
});
