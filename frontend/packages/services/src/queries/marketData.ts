import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CoverageQuery,
  Timeframe,
  UnavailableQuery,
  UniverseEntryWrite,
} from "@nova/contracts";
import {
  createUniverseEntry,
  deleteUniverseEntry,
  getCoverage,
  getCoverageDetail,
  getUnavailableDays,
  listCandles,
  listInstruments,
  listMarketIndices,
  listUniverse,
  clearNewListing,
  syncInstruments,
  updateUniverseEntry,
} from "../api/marketData";
import { queryKeys } from "./keys";
import { keepPageOptions, pageQuery, type PageSelection } from "./paging";

export function useInstruments() {
  return useQuery({
    queryKey: queryKeys.marketData.instruments,
    queryFn: ({ signal }) => listInstruments({ signal }),
  });
}

export function useCandles(symbol: string, timeframe: Timeframe | "") {
  return useQuery({
    queryKey: queryKeys.marketData.candles(symbol, timeframe),
    queryFn: ({ signal }) => listCandles(symbol, timeframe as Timeframe, { signal }),
    enabled: Boolean(symbol && timeframe),
  });
}

/** The stock list (D54). */
export function useUniverse() {
  return useQuery({
    queryKey: queryKeys.marketData.universe,
    queryFn: ({ signal }) => listUniverse({ signal }),
  });
}

function useRefreshUniverse() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.marketData.universe });
}

export function useCreateUniverseEntry() {
  const refresh = useRefreshUniverse();
  return useMutation({
    mutationFn: (body: UniverseEntryWrite) => createUniverseEntry(body),
    onSuccess: refresh,
  });
}

export function useUpdateUniverseEntry() {
  const refresh = useRefreshUniverse();
  return useMutation({
    mutationFn: (body: UniverseEntryWrite) => updateUniverseEntry(body),
    onSuccess: refresh,
  });
}

export function useDeleteUniverseEntry() {
  const refresh = useRefreshUniverse();
  return useMutation({
    mutationFn: (symbol: string) => deleteUniverseEntry(symbol),
    onSuccess: refresh,
  });
}

/** Queues a sync with Kite (a data job, D56); refreshes the data-jobs list. */
export function useSyncInstruments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncInstruments(),
    onSuccess: (job) => {
      queryClient.setQueryData(queryKeys.dataJobs.latestSync, job);
      return queryClient.invalidateQueries({ queryKey: queryKeys.dataJobs.list });
    },
  });
}

/** Every NSE index with its member count (D56). */
export function useMarketIndices() {
  return useQuery({
    queryKey: queryKeys.marketData.indices,
    queryFn: ({ signal }) => listMarketIndices({ signal }),
  });
}

/** Marks a new listing as seen; refreshes the stock list. */
export function useClearNewListing() {
  const refresh = useRefreshUniverse();
  return useMutation({
    mutationFn: (symbol: string) => clearNewListing(symbol),
    onSuccess: refresh,
  });
}

/** After a sync finishes: the stock list, indices and instruments changed. */
export function useRefreshAfterSync() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.marketData.universe }),
      queryClient.invalidateQueries({ queryKey: queryKeys.marketData.indices }),
      queryClient.invalidateQueries({ queryKey: queryKeys.marketData.instruments }),
    ]);
}

/** Stored history per stock (D63); refreshed at most once a minute and after a job is deleted. */
export function useCoverage(query: CoverageQuery, enabled = true) {
  return useQuery({
    enabled,
    queryKey: queryKeys.marketData.coverage(query),
    queryFn: ({ signal }) => getCoverage(query, { signal }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useUnavailableDays(query: UnavailableQuery, selection?: PageSelection) {
  return useInfiniteQuery({
    queryKey: ["market-data", "unavailable", query, selection],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getUnavailableDays({ ...query, ...(pageParam ? {} : pageQuery(selection)) }, pageParam, {
        signal,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 60_000,
    ...keepPageOptions,
  });
}

/** One stock's missing ranges (D63); only fetched while `symbol` is set. */
export function useCoverageDetail(symbol: string | null, query: CoverageQuery) {
  return useQuery({
    queryKey: queryKeys.marketData.coverageDetail(symbol ?? "", query),
    queryFn: ({ signal }) => getCoverageDetail(symbol ?? "", query, { signal }),
    enabled: Boolean(symbol),
    staleTime: 60_000,
  });
}
