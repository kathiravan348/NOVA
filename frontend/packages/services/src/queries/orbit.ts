import { useQuery } from "@tanstack/react-query";
import {
  getBacktest,
  getBacktestResult,
  getMe,
  getStrategy,
  listBacktests,
  listBacktestTrades,
  listStrategies,
} from "../api/orbit";
import { queryKeys } from "./keys";

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => getMe({ signal }) });
}

export function useStrategies() {
  return useQuery({
    queryKey: queryKeys.strategies.all,
    queryFn: ({ signal }) => listStrategies({ signal }),
  });
}

export function useStrategy(id: string) {
  return useQuery({
    queryKey: queryKeys.strategies.detail(id),
    queryFn: ({ signal }) => getStrategy(id, { signal }),
    enabled: Boolean(id),
  });
}

export function useBacktests() {
  return useQuery({
    queryKey: queryKeys.backtests.all,
    queryFn: ({ signal }) => listBacktests({ signal }),
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

export function useBacktestTrades(id: string) {
  return useQuery({
    queryKey: queryKeys.backtests.trades(id),
    queryFn: ({ signal }) => listBacktestTrades(id, { signal }),
    enabled: Boolean(id),
  });
}
