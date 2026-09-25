import {
  CandleSchema,
  InstrumentSchema,
  UniverseEntrySchema,
  type Candle,
  type Instrument,
  type Timeframe,
  type UniverseEntry,
} from "@nova/contracts";
import { apiGet, type RequestOptions } from "../http";

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
