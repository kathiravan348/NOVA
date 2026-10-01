import {
  LiveDaySummarySchema,
  LiveSnapshotItemSchema,
  LiveStockHistorySchema,
  LiveSymbolSchema,
  LiveSymbolsSchema,
  type LiveDaySummary,
  type LiveSnapshotItem,
  type LiveStockHistory,
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

export function getLiveStocks(
  symbols: string[],
  init?: RequestOptions,
): Promise<LiveStockHistory[]> {
  const selected = LiveSymbolsSchema.parse(symbols);
  if (!selected.length) return Promise.resolve([]);
  const query = new URLSearchParams({ symbols: selected.join(",") });
  return apiGet(`/live/stocks?${query}`, LiveStockHistorySchema.array(), init);
}
