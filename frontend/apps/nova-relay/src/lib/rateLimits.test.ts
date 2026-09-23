import { describe, expect, it } from "vitest";
import { mockRateLimits } from "@nova/mocks";
import { OWN_LIMIT_LABEL, hotWindows, usagePercent } from "./rateLimits";

describe("rate limit helpers", () => {
  it("computes usage against the own limit", () => {
    expect(
      usagePercent({
        window: "minute",
        brokerLimit: 400,
        novaLimit: 320,
        used: 272,
        resetsAt: null,
      }),
    ).toBe(85);
  });

  it("lists windows above 80%, highest first", () => {
    const hot = hotWindows(mockRateLimits);
    expect(hot.length).toBeGreaterThan(0);
    expect(hot.every((w) => w.percent > 80)).toBe(true);
    expect(hot.map((w) => w.percent)).toEqual([...hot.map((w) => w.percent)].sort((a, b) => b - a));
    expect(hot).toContainEqual(
      expect.objectContaining({ accountId: "brk_002", endpoint: "orders", window: "day" }),
    );
  });

  it("names the own limit from the brand config", () => {
    expect(OWN_LIMIT_LABEL).toMatch(/ limit$/);
  });
});
