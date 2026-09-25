import { http, HttpResponse } from "msw";
import type { UniverseEntry } from "@nova/contracts";
import { mockCandles, mockInstruments } from "../data";
import { apiPath, notFound } from "./api";

/** The mock stock list: every mock instrument, all synced with Kite. */
export const mockUniverse: UniverseEntry[] = mockInstruments
  .map((i) => ({
    symbol: i.symbol,
    name: i.name,
    sector: i.sector,
    indices: i.indices,
    synced: true,
  }))
  .sort((a, b) => a.symbol.localeCompare(b.symbol));

export const marketDataHandlers = [
  http.get(apiPath("/market-data/instruments"), () => {
    return HttpResponse.json(mockInstruments);
  }),

  http.get(apiPath("/market-data/candles"), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const symbol = params.get("symbol");
    const timeframe = params.get("timeframe");
    if (!symbol || !timeframe) {
      return notFound("symbol and timeframe are required");
    }
    if (!mockInstruments.some((i) => i.symbol === symbol)) {
      return notFound(`Instrument ${symbol} not found`);
    }
    return HttpResponse.json(mockCandles[`${symbol}:${timeframe}`] ?? []);
  }),

  http.get(apiPath("/market-data/universe"), () => {
    return HttpResponse.json(mockUniverse);
  }),
];
