import {
  BacktestDeleteResultSchema,
  BacktestResultSchema,
  BacktestRunSchema,
  StrategySchema,
  BacktestVersionSchema,
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
  type BacktestRun,
  type Strategy,
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

/** Backtest summary per strategy (D26). */
export function listStrategyStats(init?: RequestOptions): Promise<StrategyStats[]> {
  return apiGet("/strategies/stats", StrategyStatsSchema.array(), init);
}

export function getStrategy(strategyId: string, init?: RequestOptions): Promise<Strategy> {
  return apiGet(`/strategies/${id(strategyId)}`, StrategySchema, init);
}

export interface BacktestFilter {
  strategyId?: string;
}

/** One page of backtest runs, optionally for one strategy (D32). */
export function listBacktests(
  query: BacktestFilter & PageQuery = {},
  init?: RequestOptions,
): Promise<Page<BacktestRun>> {
  return apiGet(withQuery("/backtests", { ...query }), pageSchema(BacktestRunSchema), init);
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
