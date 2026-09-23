import { z } from "zod";
import { IdSchema, UtcDateTimeSchema } from "./common";

export const RateLimitEndpointSchema = z.enum(["quote", "historical", "orders", "other"]);
export type RateLimitEndpoint = z.infer<typeof RateLimitEndpointSchema>;

export const RateLimitWindowSchema = z.enum(["second", "minute", "day"]);
export type RateLimitWindow = z.infer<typeof RateLimitWindowSchema>;

/**
 * One limit window (D27). `brokerLimit` is set by the broker and read-only; `novaLimit` is our own
 * safety limit (≤ broker). `used` is the peak for second/minute windows (rolling) and the count so
 * far for the day window, which resets at `resetsAt`.
 */
export const RateLimitRuleSchema = z
  .strictObject({
    window: RateLimitWindowSchema,
    brokerLimit: z.number().int().positive(),
    novaLimit: z.number().int().positive(),
    used: z.number().int().min(0),
    resetsAt: UtcDateTimeSchema.nullable(),
  })
  .refine((r) => r.novaLimit <= r.brokerLimit, {
    message: "novaLimit must be less than or equal to brokerLimit",
    path: ["novaLimit"],
  })
  .refine((r) => r.used <= r.brokerLimit, {
    message: "used must be less than or equal to brokerLimit",
    path: ["used"],
  })
  .refine((r) => (r.window === "day") === (r.resetsAt !== null), {
    message: "resetsAt is set only for the day window",
    path: ["resetsAt"],
  });
export type RateLimitRule = z.infer<typeof RateLimitRuleSchema>;

export const RateLimitSchema = z
  .strictObject({
    accountId: IdSchema,
    endpoint: RateLimitEndpointSchema,
    rules: z.array(RateLimitRuleSchema).min(1),
    throttledToday: z.number().int().min(0),
    updatedAt: UtcDateTimeSchema,
  })
  .refine((l) => new Set(l.rules.map((r) => r.window)).size === l.rules.length, {
    message: "rules must have unique windows",
    path: ["rules"],
  });
export type RateLimit = z.infer<typeof RateLimitSchema>;

/** Request body for `PATCH /broker/rate-limits/{accountId}/{endpoint}`: changes one NOVA limit. */
export const RateLimitUpdateSchema = z.strictObject({
  window: RateLimitWindowSchema,
  novaLimit: z.number().int().positive(),
});
export type RateLimitUpdate = z.infer<typeof RateLimitUpdateSchema>;
