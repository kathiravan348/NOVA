import { useQuery } from "@tanstack/react-query";
import type { Timeframe } from "@nova/contracts";
import { listCandles, listInstruments, listUniverse } from "../api/marketData";
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
