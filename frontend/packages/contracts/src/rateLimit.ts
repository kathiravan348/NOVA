import { z } from "zod";
import { IdSchema, UtcDateTimeSchema } from "./common";

export const RateLimitEndpointSchema = z.enum(["quote", "historical", "orders", "other"]);
export type RateLimitEndpoint = z.infer<typeof RateLimitEndpointSchema>;

export const RateLimitSchema = z
  .strictObject({
    accountId: IdSchema,
    endpoint: RateLimitEndpointSchema,
    limitPerSecond: z.number().int().positive(),
    peakPerSecond: z.number().int().min(0),
    requestsToday: z.number().int().min(0),
    dailyLimit: z.number().int().positive().nullable(),
    throttledToday: z.number().int().min(0),
    updatedAt: UtcDateTimeSchema,
  })
  .refine((data) => data.peakPerSecond <= data.limitPerSecond, {
    message: "peakPerSecond must be less than or equal to limitPerSecond",
    path: ["peakPerSecond"],
  })
  .refine(
    (data) => data.dailyLimit === null || data.requestsToday <= data.dailyLimit,
    {
      message: "requestsToday must be less than or equal to dailyLimit",
      path: ["requestsToday"],
    },
  )
  .refine((data) => data.throttledToday <= data.requestsToday, {
    message: "throttledToday must be less than or equal to requestsToday",
    path: ["throttledToday"],
  });
export type RateLimit = z.infer<typeof RateLimitSchema>;
