import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Timeframe, UniverseEntryWrite } from "@nova/contracts";
import {
  createUniverseEntry,
  deleteUniverseEntry,
  listCandles,
  listInstruments,
  listUniverse,
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

/** Syncs the stock list with Kite; refreshes the list and the market-data instruments. */
export function useSyncInstruments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncInstruments(),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.marketData.universe }),
        queryClient.invalidateQueries({ queryKey: queryKeys.marketData.instruments }),
      ]),
  });
}
