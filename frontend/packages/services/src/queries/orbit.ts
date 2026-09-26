import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  BacktestRun,
  BacktestRunCreate,
  BacktestVersionCreate,
  StrategyCreate,
  StrategyUpdate,
  StrategyVersionCreate,
} from "@nova/contracts";
import {
  addBacktestVersion,
  deleteBacktest,
  deleteBacktests,
  getBacktest,
  getBacktestResult,
  getMe,
  getStrategy,
  listBacktests,
  listBacktestTrades,
  listBacktestVersions,
  listStrategies,
  listStrategyStats,
  addStrategyVersion,
  createStrategy,
  queueBacktest,
  updateStrategy,
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
/** How often run screens refresh while a run is queued or running (D58). */
export const RUN_POLL_MS = { detail: 2_000, list: 5_000 };

function isRunActive(run: Pick<BacktestRun, "status">): boolean {
  return run.status === "queued" || run.status === "running";
}

export function useBacktests(filter: BacktestFilter = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.backtests.list(filter),
    queryFn: ({ signal, pageParam }) =>
      listBacktests({ ...filter, ...cursorQuery(pageParam) }, { signal }),
    ...pagedListOptions,
    select: flattenPages,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) => page.items.some(isRunActive))
        ? RUN_POLL_MS.list
        : false,
  });
}

/** One run; refreshes while it is queued or running. When it finishes, run lists and stats refresh. */
export function useBacktest(id: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.backtests.detail(id),
    queryFn: async ({ signal }) => {
      const before = client.getQueryData<BacktestRun>(queryKeys.backtests.detail(id));
      const run = await getBacktest(id, { signal });
      if (before && isRunActive(before) && !isRunActive(run)) {
        void client.invalidateQueries({ queryKey: queryKeys.backtests.lists });
        void client.invalidateQueries({ queryKey: queryKeys.strategies.stats });
      }
      return run;
    },
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data && isRunActive(query.state.data) ? RUN_POLL_MS.detail : false,
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

function useRefreshStrategies() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.strategies.all });
}

/** Creates a strategy (D43); refreshes the strategy list and stats. */
export function useCreateStrategy() {
  const refresh = useRefreshStrategies();
  return useMutation({
    mutationFn: (body: StrategyCreate) => createStrategy(body),
    onSuccess: refresh,
  });
}

/** Saves a new version of a strategy (D43). */
export function useSaveStrategyVersion() {
  const refresh = useRefreshStrategies();
  return useMutation({
    mutationFn: ({ strategyId, ...body }: StrategyVersionCreate & { strategyId: string }) =>
      addStrategyVersion(strategyId, body),
    onSuccess: refresh,
  });
}

/** Renames or changes the status of a strategy (D43). */
export function useUpdateStrategy() {
  const refresh = useRefreshStrategies();
  return useMutation({
    mutationFn: ({ strategyId, ...body }: StrategyUpdate & { strategyId: string }) =>
      updateStrategy(strategyId, body),
    onSuccess: refresh,
  });
}

/** Queues a backtest (D44); refreshes run lists and strategy stats. */
export function useQueueBacktest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: BacktestRunCreate) => queueBacktest(body),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.backtests.all }),
        client.invalidateQueries({ queryKey: queryKeys.strategies.all }),
      ]),
  });
}

/** Every version of the backtest a run belongs to (D60). */
export function useBacktestVersions(id: string) {
  return useQuery({
    queryKey: queryKeys.backtests.versions(id),
    queryFn: ({ signal }) => listBacktestVersions(id, { signal }),
    enabled: Boolean(id),
  });
}

function useRefreshBacktests() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.backtests.all }),
      client.invalidateQueries({ queryKey: queryKeys.strategies.stats }),
    ]);
}

/** Queues the next version of a backtest (D60). */
export function useAddBacktestVersion() {
  const refresh = useRefreshBacktests();
  return useMutation({
    mutationFn: ({ runId, body }: { runId: string; body: BacktestVersionCreate }) =>
      addBacktestVersion(runId, body),
    onSuccess: refresh,
  });
}

/** After deleting whole backtests: forget their pages (no 404 refetch), refresh lists and stats. */
function useForgetBacktests() {
  const client = useQueryClient();
  return (runIds: string[]) => {
    for (const runId of runIds)
      client.removeQueries({ queryKey: queryKeys.backtests.detail(runId) });
    return Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.backtests.lists }),
      client.invalidateQueries({ queryKey: queryKeys.strategies.stats }),
    ]);
  };
}

/** Deletes a backtest (`all`) or one older version (`version`) (D60). */
export function useDeleteBacktest() {
  const refresh = useRefreshBacktests();
  const forget = useForgetBacktests();
  return useMutation({
    mutationFn: ({ runId, scope }: { runId: string; scope: "all" | "version" }) =>
      deleteBacktest(runId, scope),
    onSuccess: (_, { runId, scope }) => (scope === "all" ? forget([runId]) : refresh()),
  });
}

/** Deletes several whole backtests (D60). */
export function useDeleteBacktests() {
  const forget = useForgetBacktests();
  return useMutation({
    mutationFn: (ids: string[]) => deleteBacktests(ids),
    onSuccess: (_, ids) => forget(ids),
  });
}
