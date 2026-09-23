import { z } from "zod";
import { IdSchema, PaiseSchema, UtcDateTimeSchema } from "./common";

export const BestNetPnlSchema = z.strictObject({
  runId: IdSchema,
  netPnlPaise: PaiseSchema,
});
export type BestNetPnl = z.infer<typeof BestNetPnlSchema>;

/**
 * Backtest summary per strategy (D26), computed by the backend; screens never aggregate runs.
 * The result fields are null when the strategy has no completed run.
 */
export const StrategyStatsSchema = z
  .strictObject({
    strategyId: IdSchema,
    runsTotal: z.number().int().min(0),
    runsCompleted: z.number().int().min(0),
    runsFailed: z.number().int().min(0),
    /** Queued or running. */
    runsInProgress: z.number().int().min(0),
    lastRunAt: UtcDateTimeSchema.nullable(),
    bestReturnPercent: z.number().nullable(),
    worstReturnPercent: z.number().nullable(),
    winRateMinPercent: z.number().min(0).max(100).nullable(),
    winRateMaxPercent: z.number().min(0).max(100).nullable(),
    worstDrawdownPercent: z.number().lte(0).nullable(),
    bestNetPnl: BestNetPnlSchema.nullable(),
  })
  .refine((s) => s.runsTotal === s.runsCompleted + s.runsFailed + s.runsInProgress, {
    message: "runsTotal must equal completed + failed + in progress",
    path: ["runsTotal"],
  })
  .refine((s) => (s.runsTotal === 0) === (s.lastRunAt === null), {
    message: "lastRunAt is set exactly when there is a run",
    path: ["lastRunAt"],
  })
  .refine(
    (s) => {
      const values = [
        s.bestReturnPercent,
        s.worstReturnPercent,
        s.winRateMinPercent,
        s.winRateMaxPercent,
        s.worstDrawdownPercent,
        s.bestNetPnl,
      ];
      return s.runsCompleted > 0
        ? values.every((v) => v !== null)
        : values.every((v) => v === null);
    },
    { message: "result stats are set exactly when a run completed", path: ["runsCompleted"] },
  )
  .refine(
    (s) =>
      s.bestReturnPercent === null ||
      s.worstReturnPercent === null ||
      s.worstReturnPercent <= s.bestReturnPercent,
    {
      message: "worstReturnPercent must be at most bestReturnPercent",
      path: ["worstReturnPercent"],
    },
  )
  .refine(
    (s) =>
      s.winRateMinPercent === null ||
      s.winRateMaxPercent === null ||
      s.winRateMinPercent <= s.winRateMaxPercent,
    { message: "winRateMinPercent must be at most winRateMaxPercent", path: ["winRateMinPercent"] },
  );
export type StrategyStats = z.infer<typeof StrategyStatsSchema>;
