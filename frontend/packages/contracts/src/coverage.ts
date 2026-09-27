import { z } from "zod";
import { IsoDateSchema } from "./common";
import { IndexNameSchema } from "./strategy";

/** Stored history is checked for the two downloaded timeframes (D58, D63). */
export const CoverageTimeframeSchema = z.enum(["1m", "1d"]);
export type CoverageTimeframe = z.infer<typeof CoverageTimeframeSchema>;

/**
 * `complete`: covers the period with no missing trading day; `gaps`: some days missing inside;
 * `partial`: starts after or ends before the period (e.g. listed later, not downloaded); `none`: nothing stored.
 */
export const CoverageStatusSchema = z.enum(["complete", "gaps", "partial", "none"]);
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>;

/** One stock (or index) of `GET /market-data/coverage` (D63 (3)). */
export const CoverageRowSchema = z
  .strictObject({
    symbol: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(["stock", "index"]),
    sector: z.string().min(1),
    indices: z.array(IndexNameSchema),
    /** The whole stored range, any period. */
    firstDay: IsoDateSchema.nullable(),
    lastDay: IsoDateSchema.nullable(),
    /** Counted inside the asked period only. */
    days: z.number().int().min(0),
    missingDays: z.number().int().min(0),
    status: CoverageStatusSchema,
  })
  .refine((r) => (r.status === "none") === (r.days === 0), {
    message: "status is none exactly when no day is stored in the period",
    path: ["status"],
  })
  .refine((r) => (r.firstDay === null) === (r.lastDay === null), {
    message: "firstDay and lastDay are both set or both null",
    path: ["firstDay"],
  })
  .refine((r) => r.status !== "complete" || r.missingDays === 0, {
    message: "a complete row has no missing days",
    path: ["missingDays"],
  })
  .refine((r) => r.days === 0 || r.firstDay !== null, {
    message: "a row with days has a stored range",
    path: ["firstDay"],
  });
export type CoverageRow = z.infer<typeof CoverageRowSchema>;

/** Response of `GET /market-data/coverage?timeframe&from&to` (D63). */
export const CoverageListSchema = z
  .strictObject({
    timeframe: CoverageTimeframeSchema,
    from: IsoDateSchema,
    to: IsoDateSchema,
    /** Where the trading days came from: NIFTY 50's daily prices, else days most stocks traded. */
    calendar: z.enum(["index", "stocks"]),
    rows: z.array(CoverageRowSchema),
  })
  .refine((l) => l.from <= l.to, { message: "from must be on or before to", path: ["from"] });
export type CoverageList = z.infer<typeof CoverageListSchema>;

/** Consecutive trading days with no bar. */
export const MissingRangeSchema = z
  .strictObject({
    from: IsoDateSchema,
    to: IsoDateSchema,
    days: z.number().int().min(1),
  })
  .refine((m) => m.from <= m.to, { message: "from must be on or before to", path: ["from"] });
export type MissingRange = z.infer<typeof MissingRangeSchema>;

/** Response of `GET /market-data/coverage/{symbol}?timeframe&from&to` (D63). */
export const CoverageDetailSchema = z
  .strictObject({
    symbol: z.string().min(1),
    timeframe: CoverageTimeframeSchema,
    from: IsoDateSchema,
    to: IsoDateSchema,
    firstDay: IsoDateSchema.nullable(),
    lastDay: IsoDateSchema.nullable(),
    days: z.number().int().min(0),
    missingDays: z.number().int().min(0),
    missing: z.array(MissingRangeSchema),
  })
  .refine((d) => d.missing.reduce((sum, m) => sum + m.days, 0) === d.missingDays, {
    message: "missing ranges add up to missingDays",
    path: ["missing"],
  });
export type CoverageDetail = z.infer<typeof CoverageDetailSchema>;

/** Query of both coverage endpoints; `from`/`to` default to the last 5 years on the server. */
export interface CoverageQuery {
  timeframe: CoverageTimeframe;
  from?: string;
  to?: string;
}
