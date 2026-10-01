import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LiveTick } from "@nova/contracts";
import { getLiveDays, getLiveSnapshot, getLiveStocks } from "../api/live";
import { subscribeLiveTicks, useRealtimeStatus } from "../realtime";
import { queryKeys } from "./keys";

export function useLiveSnapshot(symbols: string[]) {
  const status = useRealtimeStatus();
  const selected = [...new Set(symbols)].sort();
  return useQuery({
    queryKey: queryKeys.live.snapshot(selected),
    queryFn: ({ signal }) => getLiveSnapshot(selected, { signal }),
    enabled: selected.length > 0,
    refetchInterval: status === "open" ? 30_000 : 5_000,
  });
}

/** Summarized history (D80): changes once a day, so no polling. */
export function useLiveStocks(symbols: string[]) {
  const selected = [...new Set(symbols)].sort();
  return useQuery({
    queryKey: queryKeys.live.stocks(selected),
    queryFn: ({ signal }) => getLiveStocks(selected, { signal }),
    enabled: selected.length > 0,
  });
}

export function useLiveDays(symbol: string | null) {
  return useQuery({
    queryKey: queryKeys.live.days(symbol ?? ""),
    queryFn: ({ signal }) => getLiveDays(symbol ?? "", { signal }),
    enabled: Boolean(symbol),
    refetchInterval: 30_000,
  });
}

/** Stable callbacks avoid replacing the selection on every tick. */
export function useLiveTicks(symbols: string[], onTick: (tick: LiveTick) => void): void {
  const selected = [...new Set(symbols)].sort().join(",");
  useEffect(
    () => subscribeLiveTicks(selected ? selected.split(",") : [], onTick),
    [selected, onTick],
  );
}
