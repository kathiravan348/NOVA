import {
  CandleSchema,
  CoverageDetailSchema,
  CoverageListSchema,
  InstrumentSchema,
  MarketIndexSchema,
  DataJobSchema,
  UniverseEntrySchema,
  UnavailableDaySchema,
  pageSchema,
  type Page,
  type UnavailableDay,
  type UnavailableQuery,
  type Candle,
  type CoverageDetail,
  type CoverageList,
  type CoverageQuery,
  type Instrument,
  type MarketIndex,
  type DataJob,
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

/** Queues an `instrument_sync` data job (D56). */
export function syncInstruments(init?: RequestOptions): Promise<DataJob> {
  return apiPost("/market-data/instruments/sync", undefined, DataJobSchema, init);
}

/** Every NSE index NOVA knows, biggest first (D56). */
export function listMarketIndices(init?: RequestOptions): Promise<MarketIndex[]> {
  return apiGet("/market-data/indices", MarketIndexSchema.array(), init);
}

/** Marks a new listing as seen (D56). */
export function clearNewListing(symbol: string, init?: RequestOptions): Promise<UniverseEntry> {
  const path = `/market-data/universe/${encodeURIComponent(symbol)}/clear-new`;
  return apiPost(path, undefined, UniverseEntrySchema, init);
}

const coverageQuery = ({ timeframe, from, to, offset, limit }: CoverageQuery) =>
  new URLSearchParams({
    timeframe,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(offset !== undefined ? { offset: String(offset) } : {}),
    ...(limit !== undefined ? { limit: String(limit) } : {}),
  }).toString();

/** Stored days per stock and index for one timeframe in a period (D63). */
export async function getCoverage(
  query: CoverageQuery,
  init?: RequestOptions,
): Promise<CoverageList> {
  const list = await apiGet(
    `/market-data/coverage?${coverageQuery(query)}`,
    CoverageListSchema,
    init,
  );
  // Existing coverage screens group the whole list locally. Explicit paging gets one page.
  if (query.offset !== undefined || query.limit !== undefined) return list;
  while (list.rows.length < list.total) {
    const next = await apiGet(
      `/market-data/coverage?${coverageQuery({ ...query, offset: list.rows.length })}`,
      CoverageListSchema,
      init,
    );
    if (next.rows.length === 0) break;
    list.rows.push(...next.rows);
  }
  return list;
}

/** One stock's stored range and its missing date ranges (D63). */
export function getCoverageDetail(
  symbol: string,
  query: CoverageQuery,
  init?: RequestOptions,
): Promise<CoverageDetail> {
  const path = `/market-data/coverage/${encodeURIComponent(symbol)}?${coverageQuery(query)}`;
  return apiGet(path, CoverageDetailSchema, init);
}

export function getUnavailableDays(
  query: UnavailableQuery,
  cursor?: string,
  init?: RequestOptions,
): Promise<Page<UnavailableDay>> {
  const params = new URLSearchParams(coverageQuery(query));
  if (query.status) params.set("status", query.status);
  if (query.symbol) params.set("symbol", query.symbol);
  if (cursor) params.set("cursor", cursor);
  if (query.cursor) params.set("cursor", query.cursor);
  return apiGet(
    `/market-data/unavailable?${params.toString()}`,
    pageSchema(UnavailableDaySchema),
    init,
  );
}
