import {
  BacktestDeleteResultSchema,
  BacktestResultSchema,
  BacktestRunListItemSchema,
  BacktestRunSchema,
  StrategySchema,
  BacktestVersionSchema,
  StrategyLibrarySchema,
  StrategyStatsSchema,
  TradeSchema,
  UserSchema,
  pageSchema,
  type BacktestDeleteResult,
  type BacktestRunCreate,
  type BacktestVersion,
  type BacktestVersionCreate,
  type StrategyCreate,
  type StrategyUpdate,
  type StrategyVersionCreate,
  type BacktestResult,
  type BacktestListSort,
  type BacktestRun,
  type BacktestRunListItem,
  type BacktestRunStatus,
  type DataSource,
  type Segment,
  type StrategyTimeframe,
  type Strategy,
  type StrategyLibrary,
  type StrategyStats,
  type Trade,
  type Page,
  type PageQuery,
  type User,
} from "@nova/contracts";
import { apiGet, apiPost, apiRequest, withQuery, type RequestOptions } from "../http";

const id = (value: string) => encodeURIComponent(value);

export function getMe(init?: RequestOptions): Promise<User> {
  return apiGet("/me", UserSchema, init);
}

export function listStrategies(init?: RequestOptions): Promise<Strategy[]> {
  return apiGet("/strategies", StrategySchema.array(), init);
}

/** Per-strategy run counts and bests, from every run or one data source's runs (D82 (10)). */
export function listStrategyStats(
  init?: RequestOptions,
  dataSource?: DataSource,
): Promise<StrategyStats[]> {
  return apiGet(withQuery("/strategies/stats", { dataSource }), StrategyStatsSchema.array(), init);
}

/** The 60 library strategies in their families (D62 (7)). */
export function getStrategyLibrary(init?: RequestOptions): Promise<StrategyLibrary> {
  return apiGet("/strategies/library", StrategyLibrarySchema, init);
}

/** Adds library entries as draft strategies, in the order given; answers the new strategies. */
export function installLibrary(ids: string[], init?: RequestOptions): Promise<Strategy[]> {
  return apiPost("/strategies/library/install", { ids }, StrategySchema.array(), init);
}

export function getStrategy(strategyId: string, init?: RequestOptions): Promise<Strategy> {
  return apiGet(`/strategies/${id(strategyId)}`, StrategySchema, init);
}

/** `GET /backtests` filters and sorting, all optional (D32, D82 (6)). */
export interface BacktestFilter {
  strategyId?: string;
  dataSource?: DataSource;
  status?: BacktestRunStatus;
  q?: string;
  segment?: Segment;
  timeframe?: StrategyTimeframe;
  minReturn?: number;
  minCagr?: number;
  /** Positive: drawdown not worse than −N %. */
  maxDrawdown?: number;
  minWinRate?: number;
  minTrades?: number;
  minProfitFactor?: number;
  profitable?: boolean;
  sort?: BacktestListSort;
  order?: "asc" | "desc";
}

/** One page of backtest runs with their results (D32, D82). */
export function listBacktests(
  query: BacktestFilter & PageQuery = {},
  init?: RequestOptions,
): Promise<Page<BacktestRunListItem>> {
  const { profitable, ...rest } = query;
  const params = { ...rest, profitable: profitable === undefined ? undefined : String(profitable) };
  return apiGet(withQuery("/backtests", params), pageSchema(BacktestRunListItemSchema), init);
}

export function getBacktest(runId: string, init?: RequestOptions): Promise<BacktestRun> {
  return apiGet(`/backtests/${id(runId)}`, BacktestRunSchema, init);
}

export function getBacktestResult(runId: string, init?: RequestOptions): Promise<BacktestResult> {
  return apiGet(`/backtests/${id(runId)}/result`, BacktestResultSchema, init);
}

/** One page of a run's trades (D32). */
export function listBacktestTrades(
  runId: string,
  query: PageQuery = {},
  init?: RequestOptions,
): Promise<Page<Trade>> {
  return apiGet(
    withQuery(`/backtests/${id(runId)}/trades`, { ...query }),
    pageSchema(TradeSchema),
    init,
  );
}

/** Creates a `draft` strategy at version 1 (D43). */
export function createStrategy(body: StrategyCreate, init?: RequestOptions): Promise<Strategy> {
  return apiPost("/strategies", body, StrategySchema, init);
}

/** Saves a new immutable version (latest + 1, D43). */
export function addStrategyVersion(
  strategyId: string,
  body: StrategyVersionCreate,
  init?: RequestOptions,
): Promise<Strategy> {
  return apiPost(`/strategies/${id(strategyId)}/versions`, body, StrategySchema, init);
}

/** Changes name, description or status (D43). */
export function updateStrategy(
  strategyId: string,
  body: StrategyUpdate,
  init?: RequestOptions,
): Promise<Strategy> {
  return apiRequest("PATCH", `/strategies/${id(strategyId)}`, body, StrategySchema, init);
}

/** Queues a backtest run (D44). */
export function queueBacktest(
  body: BacktestRunCreate,
  init?: RequestOptions,
): Promise<BacktestRun> {
  return apiPost("/backtests", body, BacktestRunSchema, init);
}

/** Every version of the backtest a run belongs to, newest first (D60). */
export function listBacktestVersions(
  runId: string,
  init?: RequestOptions,
): Promise<BacktestVersion[]> {
  return apiGet(`/backtests/${id(runId)}/versions`, BacktestVersionSchema.array(), init);
}

/** Queues the next version of a backtest: the Edit button (D60). */
export function addBacktestVersion(
  runId: string,
  body: BacktestVersionCreate,
  init?: RequestOptions,
): Promise<BacktestRun> {
  return apiPost(`/backtests/${id(runId)}/versions`, body, BacktestRunSchema, init);
}

/** `all` deletes the whole backtest (every version); `version` only this older version (D60). */
export function deleteBacktest(
  runId: string,
  scope: "all" | "version" = "all",
  init?: RequestOptions,
): Promise<BacktestDeleteResult> {
  const path = withQuery(`/backtests/${id(runId)}`, { scope });
  return apiRequest("DELETE", path, undefined, BacktestDeleteResultSchema, init);
}

/** Deletes whole backtests, every version of each (D60). */
export function deleteBacktests(
  ids: string[],
  init?: RequestOptions,
): Promise<BacktestDeleteResult> {
  return apiPost("/backtests/delete", { ids }, BacktestDeleteResultSchema, init);
}

/** Deletes a strategy with its versions and every backtest of it (D62); answers the runs deleted. */
export function deleteStrategy(
  strategyId: string,
  init?: RequestOptions,
): Promise<BacktestDeleteResult> {
  return apiRequest(
    "DELETE",
    `/strategies/${id(strategyId)}`,
    undefined,
    BacktestDeleteResultSchema,
    init,
  );
}
