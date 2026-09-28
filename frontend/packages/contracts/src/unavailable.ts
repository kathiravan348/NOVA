import { z } from "zod";
import { IdSchema, IsoDateSchema, UtcDateTimeSchema } from "./common";
import { CoverageTimeframeSchema, type CoverageQuery } from "./coverage";

/** A successful broker check that could not supply a usable candle on a known trading date. */
export const UnavailableDaySchema = z
  .strictObject({
    id: IdSchema,
    exchange: z.literal("NSE"),
    symbol: z.string().min(1),
    timeframe: CoverageTimeframeSchema,
    day: IsoDateSchema,
    broker: z.literal("Zerodha"),
    reason: z.literal("no_usable_candle"),
    firstCheckedAt: UtcDateTimeSchema,
    lastCheckedAt: UtcDateTimeSchema,
    attempts: z.number().int().min(1),
    lastJobId: IdSchema.nullable(),
    resolvedAt: UtcDateTimeSchema.nullable(),
    status: z.enum(["unavailable", "resolved"]),
  })
  .refine((r) => r.firstCheckedAt <= r.lastCheckedAt, {
    message: "last check must not precede first check",
    path: ["lastCheckedAt"],
  })
  .refine((r) => (r.status === "resolved") === (r.resolvedAt !== null), {
    message: "resolved status must have a resolution time",
    path: ["resolvedAt"],
  });

export type UnavailableDay = z.infer<typeof UnavailableDaySchema>;
export interface UnavailableQuery extends CoverageQuery {
  status?: "unavailable" | "resolved" | "all";
  symbol?: string;
}
