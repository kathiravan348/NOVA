import {
  BacktestResultSchema,
  BacktestRunSchema,
  StrategySchema,
  StrategyStatsSchema,
  TradeSchema,
  UserSchema,
  pageSchema,
  type BacktestResult,
  type BacktestRun,
  type Strategy,
  type StrategyStats,
  type Trade,
  type Page,
  type PageQuery,
  type User,
} from "@nova/contracts";
import { apiGet, withQuery, type RequestOptions } from "../http";

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
