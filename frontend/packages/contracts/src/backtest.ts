import { z } from "zod";
import {
  IdSchema,
  IsoDateSchema,
  NonNegPaiseSchema,
  PaiseSchema,
  UtcDateTimeSchema,
} from "./common";
import { UniverseSchema } from "./strategy";

export const BacktestRunStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export type BacktestRunStatus = z.infer<typeof BacktestRunStatusSchema>;

export const BacktestBenchmarkSchema = z.literal("NIFTY 50");
export type BacktestBenchmark = z.infer<typeof BacktestBenchmarkSchema>;

export const BacktestRunSchema = z
  .strictObject({
    id: IdSchema,
    strategyId: IdSchema,
    strategyVersion: z.number().int().min(1),
    name: z.string().min(1),
    universe: UniverseSchema,
    status: BacktestRunStatusSchema,
    from: IsoDateSchema,
    to: IsoDateSchema,
    initialCapitalPaise: z.number().int().positive(),
    benchmark: BacktestBenchmarkSchema.nullable(),
    createdAt: UtcDateTimeSchema,
    startedAt: UtcDateTimeSchema.nullable(),
    finishedAt: UtcDateTimeSchema.nullable(),
    error: z.string().nullable(),
  })
  .refine((data) => data.from <= data.to, {
    message: "from date must be less than or equal to to date",
    path: ["from"],
  })
  .refine((data) => data.error === null || data.status === "failed", {
    message: "error is set only when status is failed",
    path: ["error"],
  });
export type BacktestRun = z.infer<typeof BacktestRunSchema>;

export const BacktestMetricsSchema = z
  .strictObject({
    grossPnlPaise: PaiseSchema,
    chargesPaise: NonNegPaiseSchema,
    netPnlPaise: PaiseSchema,
    returnPercent: z.number(),
    cagrPercent: z.number(),
    maxDrawdownPercent: z.number().lte(0),
    sharpe: z.number(),
    winRatePercent: z.number().min(0).max(100),
    tradeCount: z.number().int().min(0),
    winCount: z.number().int().min(0),
    lossCount: z.number().int().min(0),
  })
  .refine((data) => data.netPnlPaise === data.grossPnlPaise - data.chargesPaise, {
    message: "netPnlPaise must equal grossPnlPaise minus chargesPaise",
    path: ["netPnlPaise"],
  })
  .refine((data) => data.winCount + data.lossCount <= data.tradeCount, {
    message: "winCount + lossCount must be less than or equal to tradeCount",
    path: ["tradeCount"],
  });
export type BacktestMetrics = z.infer<typeof BacktestMetricsSchema>;

export const EquityPointSchema = z.strictObject({
  date: IsoDateSchema,
  equityPaise: PaiseSchema,
  benchmarkPaise: PaiseSchema.nullable(),
});
export type EquityPoint = z.infer<typeof EquityPointSchema>;

export const BacktestResultSchema = z.strictObject({
  runId: IdSchema,
  metrics: BacktestMetricsSchema,
  equityCurve: z.array(EquityPointSchema),
});
export type BacktestResult = z.infer<typeof BacktestResultSchema>;
