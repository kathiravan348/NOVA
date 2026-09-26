import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Timeframe, UniverseEntryWrite } from "@nova/contracts";
import {
  createUniverseEntry,
  deleteUniverseEntry,
  listCandles,
  listInstruments,
  listMarketIndices,
  listUniverse,
  clearNewListing,
  syncInstruments,
  updateUniverseEntry,
} from "../api/marketData";
import { queryKeys } from "./keys";

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
