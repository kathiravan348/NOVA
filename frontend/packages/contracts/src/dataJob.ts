import { z } from "zod";
import {
  ExchangeSchema,
  IdSchema,
  IsoDateSchema,
  SegmentSchema,
  TimeframeSchema,
  UtcDateTimeSchema,
} from "./common";

export const DataJobTypeSchema = z.enum(["historical_download", "tick_record", "archive"]);
export type DataJobType = z.infer<typeof DataJobTypeSchema>;

export const DataJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type DataJobStatus = z.infer<typeof DataJobStatusSchema>;

export const DataJobSchema = z
  .strictObject({
    id: IdSchema,
    type: DataJobTypeSchema,
    status: DataJobStatusSchema,
    exchange: ExchangeSchema,
    segment: SegmentSchema,
    symbols: z.array(z.string().min(1)).min(1),
    timeframe: TimeframeSchema.nullable(),
    from: IsoDateSchema.nullable(),
    to: IsoDateSchema.nullable(),
    progressPercent: z.number().min(0).max(100),
    rowsWritten: z.number().int().min(0),
    createdAt: UtcDateTimeSchema,
    startedAt: UtcDateTimeSchema.nullable(),
    finishedAt: UtcDateTimeSchema.nullable(),
    error: z.string().nullable(),
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
      return true;
    },
    {
      message:
        "completed jobs require progressPercent 100 and finishedAt set; queued jobs require startedAt and finishedAt to be null",
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

/** Request body for `POST /data-jobs/archive` (D54): move ticks received before `before` (IST). */
export const ArchiveJobCreateSchema = z.strictObject({ before: IsoDateSchema });
export type ArchiveJobCreate = z.infer<typeof ArchiveJobCreateSchema>;
