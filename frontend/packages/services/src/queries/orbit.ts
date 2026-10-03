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
  LedgerEvent,
  Page,
  BacktestVersionCreate,
  DataSource,
  StrategyCreate,
  StrategyUpdate,
  StrategyVersionCreate,
} from "@nova/contracts";
import {
  addBacktestVersion,
  deleteBacktest,
  deleteBacktests,
  deleteStrategy,
  getBacktest,
  listBacktestLedger,
  getBacktestLedgerEvents,
  listBacktestTimeline,
  type LedgerFilter,
  type TimelineFilter,
  getBacktestResult,
  getMe,
  getStrategy,
  getStrategyLibrary,
  installLibrary,
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

export function useBacktestLedger(id: string, filter: LedgerFilter, selection: PageSelection) {
  const query = useQuery({
    queryKey: [...queryKeys.backtests.detail(id), "ledger", filter, selection],
    queryFn: ({ signal }) =>
      listBacktestLedger(id, { ...filter, ...pageQuery(selection) }, { signal }),
    enabled: Boolean(id),
  });
  return { ...query, data: query.data?.items, total: query.data?.total ?? 0 };
}

/** A run's buys and sells, oldest first; `fetchNextPage` loads the next `pageSize` (D83). */
export function useBacktestTimeline(id: string, filter: TimelineFilter, pageSize = 50) {
  const query = useInfiniteQuery({
    queryKey: [...queryKeys.backtests.detail(id), "timeline", filter, pageSize],
    queryFn: ({ signal, pageParam }) =>
      listBacktestTimeline(id, { ...filter, offset: pageParam, limit: pageSize }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (last: Page<LedgerEvent>, pages: Page<LedgerEvent>[]) => {
      const loaded = pages.reduce((count, page) => count + page.items.length, 0);
      return last.items.length > 0 && loaded < last.total ? loaded : undefined;
    },
    select: pageResult,
    enabled: Boolean(id),
  });
  return { ...query, data: query.data?.items, total: query.data?.total ?? 0 };
}

export function useBacktestLedgerEvents(id: string, date: string, symbol?: string) {
  return useQuery({
    queryKey: [...queryKeys.backtests.detail(id), "ledger", date, symbol],
    queryFn: ({ signal }) => getBacktestLedgerEvents(id, date, symbol, { signal }),
    enabled: Boolean(id && date),
  });
}
import {
  cursorQuery,
  pageResult,
  pagedListOptions,
  pageQuery,
  keepPageOptions,
  type PageSelection,
} from "./paging";

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
/** Stats from every run, or from one data source's runs (D82 (10)). */
export function useStrategyStats({ dataSource }: { dataSource?: DataSource } = {}) {
  return useQuery({
    queryKey: [...queryKeys.strategies.stats, dataSource ?? "all"],
    queryFn: ({ signal }) => listStrategyStats({ signal }, dataSource),
  });
}

/** The strategy library; it never changes while the app runs. */
export function useStrategyLibrary() {
  return useQuery({
    queryKey: queryKeys.strategyLibrary,
    queryFn: ({ signal }) => getStrategyLibrary({ signal }),
    staleTime: Infinity,
  });
}

/** Adds library entries as drafts; the strategy list and stats refresh. */
export function useInstallLibrary() {
  const refresh = useRefreshStrategies();
  return useMutation({
    mutationFn: (ids: string[]) => installLibrary(ids),
    onSuccess: refresh,
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

export function useBacktests(filter: BacktestFilter = {}, selection?: PageSelection) {
  const query = useInfiniteQuery({
    queryKey: selection
      ? [...queryKeys.backtests.list(filter), selection]
      : queryKeys.backtests.list(filter),
    queryFn: ({ signal, pageParam }) =>
      listBacktests(
        { ...filter, ...(pageParam ? cursorQuery(pageParam) : pageQuery(selection)) },
        { signal },
      ),
    ...pagedListOptions,
    select: pageResult,
    ...keepPageOptions,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) => page.items.some(isRunActive))
        ? RUN_POLL_MS.list
        : false,
  });
  return { ...query, data: query.data?.items, total: query.data?.total ?? 0 };
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
        void client.invalidateQueries({ queryKey: queryKeys.backtests.versions(id) });
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
export function useBacktestTrades(id: string, selection?: PageSelection) {
  const query = useInfiniteQuery({
    queryKey: selection
      ? [...queryKeys.backtests.trades(id), selection]
      : queryKeys.backtests.trades(id),
    queryFn: ({ signal, pageParam }) =>
      listBacktestTrades(id, pageParam ? cursorQuery(pageParam) : pageQuery(selection), { signal }),
    ...pagedListOptions,
    select: pageResult,
    ...keepPageOptions,
    enabled: Boolean(id),
  });
  return { ...query, data: query.data?.items, total: query.data?.total ?? 0 };
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

/** Deletes a strategy (D62): forget its page, refresh strategies, stats and every backtest list. */
export function useDeleteStrategy() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (strategyId: string) => deleteStrategy(strategyId),
    onSuccess: (_, strategyId) => {
      client.removeQueries({ queryKey: queryKeys.strategies.detail(strategyId) });
      return Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.strategies.all }),
        client.invalidateQueries({ queryKey: queryKeys.backtests.all }),
      ]);
    },
  });
}
