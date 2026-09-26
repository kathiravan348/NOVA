import { z } from "zod";
import {
  ExchangeSchema,
  IdSchema,
  IsoDateSchema,
  SegmentSchema,
  TimeframeSchema,
  UtcDateTimeSchema,
} from "./common";

export const DataJobTypeSchema = z.enum([
  "historical_download",
  "tick_record",
  "archive",
  "instrument_sync",
]);
export type DataJobType = z.infer<typeof DataJobTypeSchema>;

/** `draft`: planned, not started (expires after 24 h); `paused`: stopped between steps (D57). */
export const DataJobStatusSchema = z.enum([
  "draft",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "paused",
]);
export type DataJobStatus = z.infer<typeof DataJobStatusSchema>;

/** What a download does with candles already stored (D57). */
export const DownloadModeSchema = z.enum(["skip_existing", "overwrite"]);
export type DownloadMode = z.infer<typeof DownloadModeSchema>;

/** One stock of a download plan. `existingFrom`/`existingTo`: candles already stored in the period. */
export const DataJobPlanSymbolSchema = z.strictObject({
  symbol: z.string().min(1),
  steps: z.number().int().min(0),
  skippedSteps: z.number().int().min(0),
  existingFrom: IsoDateSchema.nullable(),
  existingTo: IsoDateSchema.nullable(),
});
export type DataJobPlanSymbol = z.infer<typeof DataJobPlanSymbolSchema>;

/** The cost of a download, shown before **Start** (D57 (2)). `steps` counts every step, skipped ones too. */
export const DataJobPlanSchema = z.strictObject({
  steps: z.number().int().min(0),
  skippedSteps: z.number().int().min(0),
  requests: z.number().int().min(0),
  estimatedRows: z.number().int().min(0),
  estimatedBytes: z.number().int().min(0),
  estimatedSeconds: z.number().int().min(0),
  estimatedStartAt: UtcDateTimeSchema,
  jobsAhead: z.number().int().min(0),
  perSymbol: z.array(DataJobPlanSymbolSchema),
  warnings: z.array(z.string().min(1)),
});
export type DataJobPlan = z.infer<typeof DataJobPlanSchema>;

export const DataJobSchema = z
  .strictObject({
    id: IdSchema,
    type: DataJobTypeSchema,
    status: DataJobStatusSchema,
    exchange: ExchangeSchema,
    segment: SegmentSchema,
    // Empty only for `instrument_sync` (D56).
    symbols: z.array(z.string().min(1)),
    timeframe: TimeframeSchema.nullable(),
    from: IsoDateSchema.nullable(),
    to: IsoDateSchema.nullable(),
    progressPercent: z.number().min(0).max(100),
    rowsWritten: z.number().int().min(0),
    createdAt: UtcDateTimeSchema,
    startedAt: UtcDateTimeSchema.nullable(),
    finishedAt: UtcDateTimeSchema.nullable(),
    error: z.string().nullable(),
    summary: z.string().max(500).nullable(),
    // Planned downloads (D57); null / 0 for other jobs and downloads queued before plans.
    mode: DownloadModeSchema.nullable(),
    plan: DataJobPlanSchema.nullable(),
    stepsDone: z.number().int().min(0),
    stepsTotal: z.number().int().min(0),
    expiresAt: UtcDateTimeSchema.nullable(),
  })
  .refine(
    (data) => {
      if (data.type === "historical_download") {
        return data.timeframe !== null && data.from !== null && data.to !== null;
      }
      if (data.type === "tick_record") {
        return data.timeframe === null;
      }
      return true;
    },
    {
      message:
        "historical_download requires timeframe, from, and to; tick_record requires timeframe to be null",
      path: ["type"],
    },
  )
  .refine(
    (data) =>
      (data.from === null && data.to === null) ||
      (data.from !== null && data.to !== null && data.from <= data.to),
    {
      message: "from and to must both be null or both set with from <= to",
      path: ["from"],
    },
  )
  .refine((data) => data.symbols.length > 0 || data.type === "instrument_sync", {
    message: "symbols may be empty only for instrument_sync",
    path: ["symbols"],
  })
  .refine((data) => data.error === null || data.status === "failed", {
    message: "error is set only when status is failed",
    path: ["error"],
  })
  .refine(
    (data) => {
      if (data.status === "completed") {
        return data.progressPercent === 100 && data.finishedAt !== null;
      }
      if (data.status === "queued") {
        return data.startedAt === null && data.finishedAt === null;
      }
      if (data.status === "draft") {
        return (
          data.startedAt === null &&
          data.finishedAt === null &&
          data.plan !== null &&
          data.expiresAt !== null
        );
      }
      return true;
    },
    {
      message:
        "completed jobs require progressPercent 100 and finishedAt set; queued jobs require startedAt and finishedAt to be null; drafts need a plan and expiresAt",
      path: ["status"],
    },
  );
export type DataJob = z.infer<typeof DataJobSchema>;

export const MAX_DOWNLOAD_SYMBOLS = 200;

/** Request body for `POST /data-jobs` (D54): queue a historical download. */
export const DataJobCreateSchema = z
  .strictObject({
    symbols: z
      .array(z.string().min(1))
      .min(1, "Pick at least one stock")
      .max(MAX_DOWNLOAD_SYMBOLS, `Pick at most ${MAX_DOWNLOAD_SYMBOLS} stocks`),
    timeframe: TimeframeSchema,
    from: IsoDateSchema,
    to: IsoDateSchema,
    segment: SegmentSchema.default("equity_delivery"),
  })
  .refine((data) => data.from <= data.to, {
    message: "From must be on or before To",
    path: ["from"],
  });
export type DataJobCreate = z.input<typeof DataJobCreateSchema>;

/** Body of `POST /data-jobs/plan` (D57): a download to plan as a `draft`, and what to do with stored candles. */
export const DataJobPlanRequestSchema = z
  .strictObject({
    symbols: z
      .array(z.string().min(1))
      .min(1, "Pick at least one stock")
      .max(MAX_DOWNLOAD_SYMBOLS, `Pick at most ${MAX_DOWNLOAD_SYMBOLS} stocks`),
    timeframe: TimeframeSchema,
    from: IsoDateSchema,
    to: IsoDateSchema,
    segment: SegmentSchema.default("equity_delivery"),
    mode: DownloadModeSchema.default("skip_existing"),
  })
  .refine((data) => data.from <= data.to, {
    message: "From must be on or before To",
    path: ["from"],
  });
export type DataJobPlanRequest = z.input<typeof DataJobPlanRequestSchema>;

/** Pace of downloads on weekdays 09:15–15:30 IST (D57 (5)): `slow` at most 1 request/s, `full` 2/s. */
export const MarketHoursModeSchema = z.enum(["slow", "full"]);
export type MarketHoursMode = z.infer<typeof MarketHoursModeSchema>;

export const DownloadSettingsSchema = z.strictObject({ marketHoursMode: MarketHoursModeSchema });
export type DownloadSettings = z.infer<typeof DownloadSettingsSchema>;

/** Body of `PATCH /data-jobs/settings`. */
export const DownloadSettingsUpdateSchema = DownloadSettingsSchema;
export type DownloadSettingsUpdate = z.infer<typeof DownloadSettingsUpdateSchema>;

/** Request body for `POST /data-jobs/archive` (D54): move ticks received before `before` (IST). */
export const ArchiveJobCreateSchema = z.strictObject({ before: IsoDateSchema });
export type ArchiveJobCreate = z.infer<typeof ArchiveJobCreateSchema>;

/** Answer of `DELETE /data-jobs/{id}?candles=` (NOVA-095). */
export const DataJobDeleteResultSchema = z.strictObject({
  id: IdSchema,
  candlesDeleted: z.number().int().min(0),
});
export type DataJobDeleteResult = z.infer<typeof DataJobDeleteResultSchema>;
