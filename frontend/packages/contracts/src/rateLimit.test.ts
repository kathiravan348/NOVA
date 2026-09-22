import { describe, expect, it } from "vitest";
import { RateLimit, RateLimitEndpointSchema, RateLimitSchema } from "./rateLimit";

describe("RateLimit schemas", () => {
  const validRateLimit: RateLimit = {
    accountId: "acc-001",
    endpoint: "quote",
    limitPerSecond: 10,
    peakPerSecond: 8,
    requestsToday: 1250,
    dailyLimit: 10000,
    throttledToday: 3,
    updatedAt: "2026-01-01T12:00:00Z",
  };

  describe("RateLimitEndpointSchema", () => {
    it("accepts valid endpoints", () => {
      expect(RateLimitEndpointSchema.safeParse("quote").success).toBe(true);
      expect(RateLimitEndpointSchema.safeParse("historical").success).toBe(true);
      expect(RateLimitEndpointSchema.safeParse("orders").success).toBe(true);
      expect(RateLimitEndpointSchema.safeParse("other").success).toBe(true);
    });

    it("rejects invalid endpoint enum", () => {
      expect(RateLimitEndpointSchema.safeParse("portfolio").success).toBe(false);
    });
  });

  describe("RateLimitSchema", () => {
    it("accepts a valid rate limit with dailyLimit", () => {
      expect(RateLimitSchema.safeParse(validRateLimit).success).toBe(true);
    });

    it("accepts a valid rate limit with null dailyLimit", () => {
      const validNullDaily: RateLimit = {
        ...validRateLimit,
        dailyLimit: null,
      };
      expect(RateLimitSchema.safeParse(validNullDaily).success).toBe(true);
    });

    it("rejects when peakPerSecond exceeds limitPerSecond", () => {
      const invalid = {
        ...validRateLimit,
        limitPerSecond: 10,
        peakPerSecond: 11,
      };
      expect(RateLimitSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects when requestsToday exceeds dailyLimit", () => {
      const invalid = {
        ...validRateLimit,
        requestsToday: 15000,
        dailyLimit: 10000,
      };
      expect(RateLimitSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects when throttledToday exceeds requestsToday", () => {
      const invalid = {
        ...validRateLimit,
        requestsToday: 5,
        throttledToday: 10,
      };
      expect(RateLimitSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects non-positive limitPerSecond", () => {
      expect(RateLimitSchema.safeParse({ ...validRateLimit, limitPerSecond: 0 }).success).toBe(
        false,
      );
      expect(RateLimitSchema.safeParse({ ...validRateLimit, limitPerSecond: -2 }).success).toBe(
        false,
      );
    });

    it("rejects negative peakPerSecond", () => {
      expect(RateLimitSchema.safeParse({ ...validRateLimit, peakPerSecond: -1 }).success).toBe(
        false,
      );
    });

    it("rejects non-positive dailyLimit when set", () => {
      expect(RateLimitSchema.safeParse({ ...validRateLimit, dailyLimit: 0 }).success).toBe(false);
      expect(RateLimitSchema.safeParse({ ...validRateLimit, dailyLimit: -100 }).success).toBe(
        false,
      );
    });

    it("rejects extra fields because of strictObject", () => {
      const invalid = { ...validRateLimit, extra: "value" };
      expect(RateLimitSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
