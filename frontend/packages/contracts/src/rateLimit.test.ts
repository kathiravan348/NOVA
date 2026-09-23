import { describe, expect, it } from "vitest";
import {
  RateLimitEndpointSchema,
  RateLimitRuleSchema,
  RateLimitSchema,
  RateLimitUpdateSchema,
  type RateLimit,
  type RateLimitRule,
} from "./rateLimit";

const secondRule: RateLimitRule = {
  window: "second",
  brokerLimit: 10,
  novaLimit: 8,
  used: 6,
  resetsAt: null,
};
const dayRule: RateLimitRule = {
  window: "day",
  brokerLimit: 5000,
  novaLimit: 4000,
  used: 1200,
  resetsAt: "2026-09-21T18:30:00Z",
};
const validRateLimit: RateLimit = {
  accountId: "acc-001",
  endpoint: "orders",
  rules: [secondRule, dayRule],
  throttledToday: 3,
  updatedAt: "2026-01-01T12:00:00Z",
};

describe("RateLimitEndpointSchema", () => {
  it("accepts the four endpoints and rejects others", () => {
    for (const e of ["quote", "historical", "orders", "other"]) {
      expect(RateLimitEndpointSchema.safeParse(e).success).toBe(true);
    }
    expect(RateLimitEndpointSchema.safeParse("portfolio").success).toBe(false);
  });
});

describe("RateLimitRuleSchema", () => {
  it("accepts valid second and day rules", () => {
    expect(RateLimitRuleSchema.parse(secondRule)).toEqual(secondRule);
    expect(RateLimitRuleSchema.parse(dayRule)).toEqual(dayRule);
  });

  it("rejects novaLimit above brokerLimit", () => {
    expect(RateLimitRuleSchema.safeParse({ ...secondRule, novaLimit: 11 }).success).toBe(false);
  });

  it("rejects used above brokerLimit and negative used", () => {
    expect(RateLimitRuleSchema.safeParse({ ...secondRule, used: 11 }).success).toBe(false);
    expect(RateLimitRuleSchema.safeParse({ ...secondRule, used: -1 }).success).toBe(false);
  });

  it("requires resetsAt for day and forbids it for other windows", () => {
    expect(RateLimitRuleSchema.safeParse({ ...dayRule, resetsAt: null }).success).toBe(false);
    expect(
      RateLimitRuleSchema.safeParse({ ...secondRule, resetsAt: "2026-09-21T18:30:00Z" }).success,
    ).toBe(false);
  });

  it("rejects non-positive limits", () => {
    expect(RateLimitRuleSchema.safeParse({ ...secondRule, novaLimit: 0 }).success).toBe(false);
    expect(RateLimitRuleSchema.safeParse({ ...secondRule, brokerLimit: 0 }).success).toBe(false);
  });
});

describe("RateLimitSchema", () => {
  it("accepts a valid rate limit", () => {
    expect(RateLimitSchema.parse(validRateLimit)).toEqual(validRateLimit);
  });

  it("rejects empty rules and duplicate windows", () => {
    expect(RateLimitSchema.safeParse({ ...validRateLimit, rules: [] }).success).toBe(false);
    expect(
      RateLimitSchema.safeParse({ ...validRateLimit, rules: [secondRule, secondRule] }).success,
    ).toBe(false);
  });

  it("rejects extra fields", () => {
    expect(RateLimitSchema.safeParse({ ...validRateLimit, extra: 1 }).success).toBe(false);
  });
});

describe("RateLimitUpdateSchema", () => {
  it("accepts a window and positive limit only", () => {
    expect(RateLimitUpdateSchema.safeParse({ window: "minute", novaLimit: 300 }).success).toBe(
      true,
    );
    expect(RateLimitUpdateSchema.safeParse({ window: "minute", novaLimit: 0 }).success).toBe(false);
    expect(RateLimitUpdateSchema.safeParse({ window: "hour", novaLimit: 5 }).success).toBe(false);
    expect(
      RateLimitUpdateSchema.safeParse({ window: "day", novaLimit: 5, brokerLimit: 9 }).success,
    ).toBe(false);
  });
});
