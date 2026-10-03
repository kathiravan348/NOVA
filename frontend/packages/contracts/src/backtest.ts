import { z } from "zod";
import {
  DataSourceSchema,
  IdSchema,
  SegmentSchema,
  StrategyTimeframeSchema,
  IsoDateSchema,
  NonNegPaiseSchema,
  PaiseSchema,
  UtcDateTimeSchema,
} from "./common";
import { IndexNameSchema, UniverseSchema } from "./strategy";
import { UniverseSymbolSchema } from "./universe";
import { ExitReasonSchema } from "./trade";
import { ScenarioSchema, type Scenario } from "./intraday";

export const LedgerDaySchema = z.strictObject({
  date: IsoDateSchema,
  buys: z.number().int().min(0),
  sells: z.number().int().min(0),
  boughtPaise: NonNegPaiseSchema,
  soldPaise: NonNegPaiseSchema,
  chargesPaise: NonNegPaiseSchema,
  netPnlPaise: PaiseSchema,
  cashPaise: PaiseSchema,
  holdingsPaise: PaiseSchema,
  equityPaise: PaiseSchema,
  openPositions: z.number().int().min(0),
});
export type LedgerDay = z.infer<typeof LedgerDaySchema>;

export const LedgerEventSchema = z.strictObject({
  at: UtcDateTimeSchema,
  /** When the sold position was bought (D83); null on buys. */
  entryAt: UtcDateTimeSchema.nullable(),
  symbol: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  qty: z.number().int().positive(),
  pricePaise: z.number().int().positive(),
  amountPaise: NonNegPaiseSchema,
  chargesPaise: NonNegPaiseSchema,
  netPnlPaise: PaiseSchema.nullable(),
  reason: ExitReasonSchema.nullable(),
  cashAfterPaise: PaiseSchema,
});
export type LedgerEvent = z.infer<typeof LedgerEventSchema>;

export const BacktestRunStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export type BacktestRunStatus = z.infer<typeof BacktestRunStatusSchema>;

export const BacktestStageSchema = z.enum(["loading", "signals", "simulating", "saving", "done"]);
export type BacktestStage = z.infer<typeof BacktestStageSchema>;

/** What a started run is doing (D58); a failed run keeps its last progress. */
export const BacktestProgressSchema = z.strictObject({
  stage: BacktestStageSchema,
  percent: z.number().int().min(0).max(100),
  symbolsDone: z.number().int().min(0),
  symbolsTotal: z.number().int().min(0),
  barsDone: z.number().int().min(0),
  barsTotal: z.number().int().min(0),
  tradesSoFar: z.number().int().min(0),
  simulatedTo: IsoDateSchema.nullable(),
});
export type BacktestProgress = z.infer<typeof BacktestProgressSchema>;

export const BacktestBenchmarkSchema = IndexNameSchema;
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
    progress: BacktestProgressSchema.nullable(),
    /** D60: versions of one backtest share `rootId` (the first run's id). */
    rootId: IdSchema,
    version: z.number().int().min(1),
    /** False for an older version trimmed to its summary (no trades, curve or per-symbol rows). */
    reportKept: z.boolean(),
    skippedSymbols: z.array(UniverseSymbolSchema),
    /** D82: `recorded` runs use candles built from recorded ticks. */
    dataSource: DataSourceSchema,
    recordedDaysUsed: z.number().int().nonnegative().nullable(),
    recordedDaysSkipped: z.array(IsoDateSchema),
    /** D84: intraday runs only; null on every other run. */
    profileId: IdSchema.nullable().default(null),
    profileVersion: z.number().int().min(1).nullable().default(null),
    scenario: ScenarioSchema.nullable().default(null),
    experimentId: IdSchema.nullable().default(null),
  })
  .refine((data) => data.from <= data.to, {
    message: "from date must be less than or equal to to date",
    path: ["from"],
  })
  .refine((data) => data.error === null || data.status === "failed", {
    message: "error is set only when status is failed",
    path: ["error"],
  })
  .refine(
    (data) =>
      data.status !== "completed" ||
      (data.progress?.stage === "done" && data.progress.percent === 100),
    { message: "a completed run has progress done at 100 percent", path: ["progress"] },
  )
  .refine((data) => (data.version === 1) === (data.rootId === data.id), {
    message: "rootId equals id exactly for version 1",
    path: ["rootId"],
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
    /** D62 (6): null for runs made before these numbers existed, or when they do not apply. */
    benchmarkReturnPercent: z.number().nullable(),
    benchmarkCagrPercent: z.number().nullable(),
    exposurePercent: z.number().min(0).max(100).nullable(),
    avgHoldDays: z.number().min(0).nullable(),
    profitFactor: z.number().min(0).nullable(),
    calmar: z.number().nullable(),
    /** Delivery runs only (intraday profit is business income): today's tax rates for every year. */
    estimatedTaxPaise: NonNegPaiseSchema.nullable(),
    afterTaxNetPnlPaise: PaiseSchema.nullable(),
    afterTaxCagrPercent: z.number().nullable(),
    /** D82: recorded runs only: Σ |fill − last price| × qty. */
    spreadCostPaise: NonNegPaiseSchema.nullable().optional(),
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

/** Results for one symbol of a run (R2); computed by the backend like the run metrics. */
export const SymbolBreakdownSchema = z
  .strictObject({
    symbol: z.string().min(1),
    tradeCount: z.number().int().min(0),
    winCount: z.number().int().min(0),
    lossCount: z.number().int().min(0),
    winRatePercent: z.number().min(0).max(100),
    netPnlPaise: PaiseSchema,
  })
  .refine((b) => b.winCount + b.lossCount <= b.tradeCount, {
    message: "winCount + lossCount must not exceed tradeCount",
    path: ["winCount"],
  });
export type SymbolBreakdown = z.infer<typeof SymbolBreakdownSchema>;

/** One 12-month block from the run's start date (the last may be short), D62 (6). */
export const YearRowSchema = z
  .strictObject({
    year: z.number().int().min(1),
    from: IsoDateSchema,
    to: IsoDateSchema,
    returnPercent: z.number(),
    profitPaise: PaiseSchema,
    maxDrawdownPercent: z.number().lte(0),
    benchmarkPercent: z.number().nullable(),
  })
  .refine((y) => y.from <= y.to, { message: "from must be on or before to", path: ["from"] });
export type YearRow = z.infer<typeof YearRowSchema>;

export const BacktestResultSchema = z
  .strictObject({
    runId: IdSchema,
    metrics: BacktestMetricsSchema,
    equityCurve: z.array(EquityPointSchema),
    bySymbol: z.array(SymbolBreakdownSchema),
    /** Year-by-year results (D62); empty for older runs. */
    years: z.array(YearRowSchema),
  })
  .refine((r) => new Set(r.bySymbol.map((b) => b.symbol)).size === r.bySymbol.length, {
    message: "bySymbol must list each symbol once",
    path: ["bySymbol"],
  });
export type BacktestResult = z.infer<typeof BacktestResultSchema>;

/** A completed run's key results for the Backtests list (D82 (6)). */
export const BacktestRunSummarySchema = z.strictObject({
  netPnlPaise: PaiseSchema,
  returnPercent: z.number(),
  cagrPercent: z.number(),
  maxDrawdownPercent: z.number().lte(0),
  winRatePercent: z.number().min(0).max(100),
  tradeCount: z.number().int().nonnegative(),
  profitFactor: z.number().nonnegative().nullable(),
  sharpe: z.number(),
  afterTaxCagrPercent: z.number().nullable(),
  spreadCostPaise: NonNegPaiseSchema.nullable(),
});
export type BacktestRunSummary = z.infer<typeof BacktestRunSummarySchema>;

/** `GET /backtests` rows (D82 (6)): the run plus its strategy version's segment and timeframe,
 * and its results (`summary` null until completed). */
export const BacktestRunListItemSchema = BacktestRunSchema.safeExtend({
  segment: SegmentSchema,
  timeframe: StrategyTimeframeSchema,
  summary: BacktestRunSummarySchema.nullable(),
});
export type BacktestRunListItem = z.infer<typeof BacktestRunListItemSchema>;

/** Sorts `GET /backtests` offers; every sort but `created` pages by offset only. */
export const BacktestListSortSchema = z.enum([
  "created",
  "netPnl",
  "return",
  "cagr",
  "maxDrawdown",
  "winRate",
  "profitFactor",
  "sharpe",
  "trades",
]);
export type BacktestListSort = z.infer<typeof BacktestListSortSchema>;

/** D84: an intraday run names a research profile version and a scenario; all three or none. */
const profileChoiceFields = {
  profileId: IdSchema.nullable().optional(),
  profileVersion: z.number().int().min(1).nullable().optional(),
  scenario: ScenarioSchema.nullable().optional(),
};

const profileChoiceTogether = (data: {
  profileId?: string | null | undefined;
  profileVersion?: number | null | undefined;
  scenario?: Scenario | null | undefined;
}) => {
  const given = [data.profileId, data.profileVersion, data.scenario].filter((v) => v != null);
  return given.length === 0 || given.length === 3;
};
const profileChoiceMessage = {
  message: "profileId, profileVersion and scenario go together",
  path: ["profileId"],
};

/** Body of `POST /backtests` (D44): queues a run of one strategy version on a universe. */
export const BacktestRunCreateSchema = z
  .strictObject({
    strategyId: IdSchema,
    strategyVersion: z.number().int().min(1),
    name: z.string().min(1),
    universe: UniverseSchema,
    from: IsoDateSchema,
    to: IsoDateSchema,
    initialCapitalPaise: z.number().int().positive(),
    benchmark: BacktestBenchmarkSchema.nullable(),
    /** Absent = `history` (D82). */
    dataSource: DataSourceSchema.optional(),
    ...profileChoiceFields,
  })
  .refine((data) => data.from <= data.to, {
    message: "from date must be less than or equal to to date",
    path: ["from"],
  })
  .refine(profileChoiceTogether, profileChoiceMessage);
export type BacktestRunCreate = z.infer<typeof BacktestRunCreateSchema>;

/** Body of `POST /backtests/{id}/versions` (D60): the next version of the same strategy. */
export const BacktestVersionCreateSchema = z
  .strictObject({
    strategyVersion: z.number().int().min(1),
    name: z.string().min(1),
    universe: UniverseSchema,
    from: IsoDateSchema,
    to: IsoDateSchema,
    initialCapitalPaise: z.number().int().positive(),
    benchmark: BacktestBenchmarkSchema.nullable(),
    /** Absent or null = the previous version's source (D82). */
    dataSource: DataSourceSchema.nullable().optional(),
    ...profileChoiceFields,
  })
  .refine((data) => data.from <= data.to, {
    message: "from date must be less than or equal to to date",
    path: ["from"],
  })
  .refine(profileChoiceTogether, profileChoiceMessage);
export type BacktestVersionCreate = z.infer<typeof BacktestVersionCreateSchema>;

/** One version of a backtest in its history (D60); metrics only when completed. */
export const BacktestVersionSchema = z
  .strictObject({
    runId: IdSchema,
    version: z.number().int().min(1),
    status: BacktestRunStatusSchema,
    strategyVersion: z.number().int().min(1),
    name: z.string().min(1),
    universe: UniverseSchema,
    from: IsoDateSchema,
    to: IsoDateSchema,
    initialCapitalPaise: z.number().int().positive(),
    benchmark: BacktestBenchmarkSchema.nullable(),
    createdAt: UtcDateTimeSchema,
    error: z.string().nullable(),
    reportKept: z.boolean(),
    dataSource: DataSourceSchema,
    recordedDaysUsed: z.number().int().nonnegative().nullable(),
    recordedDaysSkipped: z.array(IsoDateSchema),
    metrics: BacktestMetricsSchema.nullable(),
  })
  .refine((data) => data.from <= data.to, {
    message: "from date must be less than or equal to to date",
    path: ["from"],
  })
  .refine((data) => (data.metrics !== null) === (data.status === "completed"), {
    message: "metrics are set exactly when the version completed",
    path: ["metrics"],
  });
export type BacktestVersion = z.infer<typeof BacktestVersionSchema>;

/** Body of `POST /backtests/delete` (D60): whole backtests, every version. */
export const BacktestDeleteRequestSchema = z.strictObject({
  ids: z.array(IdSchema).min(1).max(100),
});
export type BacktestDeleteRequest = z.infer<typeof BacktestDeleteRequestSchema>;

export const BacktestDeleteResultSchema = z.strictObject({
  deletedRuns: z.number().int().min(0),
});
export type BacktestDeleteResult = z.infer<typeof BacktestDeleteResultSchema>;
