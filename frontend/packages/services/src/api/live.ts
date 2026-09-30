import {
  LiveDaySummarySchema,
  LiveSnapshotItemSchema,
  LiveSymbolSchema,
  LiveSymbolsSchema,
  type LiveDaySummary,
  type LiveSnapshotItem,
} from "@nova/contracts";
import { apiGet, type RequestOptions } from "../http";

export function getLiveSnapshot(
  symbols: string[],
  init?: RequestOptions,
): Promise<LiveSnapshotItem[]> {
  const selected = LiveSymbolsSchema.parse(symbols);
  if (!selected.length) return Promise.resolve([]);
  const query = new URLSearchParams({ symbols: selected.join(",") });
  return apiGet(`/live/snapshot?${query}`, LiveSnapshotItemSchema.array(), init);
}

export function getLiveDays(symbol: string, init?: RequestOptions): Promise<LiveDaySummary[]> {
  const query = new URLSearchParams({ symbol: LiveSymbolSchema.parse(symbol) });
  return apiGet(`/live/days?${query}`, LiveDaySummarySchema.array(), init);
}
