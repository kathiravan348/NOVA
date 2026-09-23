import {
  BacktestResultSchema,
  BacktestRunSchema,
  StrategySchema,
  StrategyStatsSchema,
  TradeSchema,
  UserSchema,
  type BacktestResult,
  type BacktestRun,
  type Strategy,
  type StrategyStats,
  type Trade,
  type User,
} from "@nova/contracts";
import { apiGet, type RequestOptions } from "../http";

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

export function listBacktests(init?: RequestOptions): Promise<BacktestRun[]> {
  return apiGet("/backtests", BacktestRunSchema.array(), init);
}

export function getBacktest(runId: string, init?: RequestOptions): Promise<BacktestRun> {
  return apiGet(`/backtests/${id(runId)}`, BacktestRunSchema, init);
}

export function getBacktestResult(runId: string, init?: RequestOptions): Promise<BacktestResult> {
  return apiGet(`/backtests/${id(runId)}/result`, BacktestResultSchema, init);
}

export function listBacktestTrades(runId: string, init?: RequestOptions): Promise<Trade[]> {
  return apiGet(`/backtests/${id(runId)}/trades`, TradeSchema.array(), init);
}
