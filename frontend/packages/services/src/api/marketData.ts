import {
  CandleSchema,
  InstrumentSchema,
  InstrumentSyncResultSchema,
  UniverseEntrySchema,
  type Candle,
  type Instrument,
  type InstrumentSyncResult,
  type Timeframe,
  type UniverseEntry,
  type UniverseEntryWrite,
} from "@nova/contracts";
import { apiGet, apiPost, apiRequest, apiSend, type RequestOptions } from "../http";

export function listInstruments(init?: RequestOptions): Promise<Instrument[]> {
  return apiGet("/market-data/instruments", InstrumentSchema.array(), init);
}

export function listCandles(
  symbol: string,
  timeframe: Timeframe,
  init?: RequestOptions,
): Promise<Candle[]> {
  const query = new URLSearchParams({ symbol, timeframe });
  return apiGet(`/market-data/candles?${query.toString()}`, CandleSchema.array(), init);
}

/** The stock list: what can be synced with Kite and downloaded (D54). */
export function listUniverse(init?: RequestOptions): Promise<UniverseEntry[]> {
  return apiGet("/market-data/universe", UniverseEntrySchema.array(), init);
}

/** Adds a stock to the list (not synced with Kite yet). */
export function createUniverseEntry(
  body: UniverseEntryWrite,
  init?: RequestOptions,
): Promise<UniverseEntry> {
  return apiPost("/market-data/universe", body, UniverseEntrySchema, init);
}

/** Changes a stock's name, sector or indices; the symbol stays. */
export function updateUniverseEntry(
  body: UniverseEntryWrite,
  init?: RequestOptions,
): Promise<UniverseEntry> {
  const path = `/market-data/universe/${encodeURIComponent(body.symbol)}`;
  return apiRequest("PUT", path, body, UniverseEntrySchema, init);
}

/** Removes a stock from the list; its downloaded prices stay. */
export function deleteUniverseEntry(symbol: string, init?: RequestOptions): Promise<void> {
  return apiSend("DELETE", `/market-data/universe/${encodeURIComponent(symbol)}`, undefined, init);
}

/** Asks Kite for tokens and lot sizes of every listed stock (needs a Kite login). */
export function syncInstruments(init?: RequestOptions): Promise<InstrumentSyncResult> {
  return apiPost("/market-data/instruments/sync", undefined, InstrumentSyncResultSchema, init);
}
