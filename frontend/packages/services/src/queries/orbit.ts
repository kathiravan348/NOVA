import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import {
  getBacktest,
  getBacktestResult,
  getMe,
  getStrategy,
  listBacktests,
  listBacktestTrades,
  listStrategies,
  listStrategyStats,
  type BacktestFilter,
} from "../api/orbit";
import { queryKeys } from "./keys";
import { cursorQuery, flattenPages, pagedListOptions } from "./paging";

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => getMe({ signal }) });
}

export function useStrategies() {
  return useQuery({
    queryKey: queryKeys.strategies.all,
    queryFn: ({ signal }) => listStrategies({ signal }),
  });
}

/** Backtest summary for every strategy (D26). */
export function useStrategyStats() {
  return useQuery({
    queryKey: queryKeys.strategies.stats,
    queryFn: ({ signal }) => listStrategyStats({ signal }),
  });
}

export function useStrategy(id: string) {
  return useQuery({
    queryKey: queryKeys.strategies.detail(id),
    queryFn: ({ signal }) => getStrategy(id, { signal }),
    enabled: Boolean(id),
  });
}

/** Backtest runs, one page at a time; `fetchNextPage` loads more. */
export function useBacktests(filter: BacktestFilter = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.backtests.list(filter),
    queryFn: ({ signal, pageParam }) =>
      listBacktests({ ...filter, ...cursorQuery(pageParam) }, { signal }),
    ...pagedListOptions,
    select: flattenPages,
  });
}

export function useBacktest(id: string) {
  return useQuery({
    queryKey: queryKeys.backtests.detail(id),
    queryFn: ({ signal }) => getBacktest(id, { signal }),
    enabled: Boolean(id),
  });
}

export function useBacktestResult(id: string) {
  return useQuery({
    queryKey: queryKeys.backtests.result(id),
    queryFn: ({ signal }) => getBacktestResult(id, { signal }),
    enabled: Boolean(id),
  });
}

/** A run's trades, one page at a time; `fetchNextPage` loads more. */
export function useBacktestTrades(id: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.backtests.trades(id),
    queryFn: ({ signal, pageParam }) => listBacktestTrades(id, cursorQuery(pageParam), { signal }),
    ...pagedListOptions,
    select: flattenPages,
    enabled: Boolean(id),
  });
}

/** One result query per run id (same cache entries as useBacktestResult). */
export function useBacktestResults(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.backtests.result(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getBacktestResult(id, { signal }),
    })),
  });
}
