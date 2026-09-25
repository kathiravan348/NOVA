import { http, HttpResponse } from "msw";
import { UniverseEntryWriteSchema, type UniverseEntry } from "@nova/contracts";
import { mockCandles, mockInstruments } from "../data";
import { apiPath, badRequest, notFound } from "./api";

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

const trimmed = (e: Omit<UniverseEntry, "synced">) => ({
  ...e,
  name: e.name.trim(),
  sector: e.sector.trim(),
});

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

  // Demo: the stock-list writes validate like the server and answer without storing (D54).
  http.post(apiPath("/market-data/universe"), async ({ request }) => {
    const parsed = UniverseEntryWriteSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid stock");
    }
    if (mockUniverse.some((e) => e.symbol === parsed.data.symbol)) {
      return badRequest(`${parsed.data.symbol} is already in the stock list`);
    }
    const entry: UniverseEntry = { ...trimmed(parsed.data), synced: false };
    return HttpResponse.json(entry, { status: 201 });
  }),

  http.put(apiPath("/market-data/universe/:symbol"), async ({ params, request }) => {
    const symbol = params["symbol"] as string;
    const existing = mockUniverse.find((e) => e.symbol === symbol);
    if (!existing) {
      return notFound(`${symbol} is not in the stock list`);
    }
    const parsed = UniverseEntryWriteSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid stock");
    }
    if (parsed.data.symbol !== symbol) {
      return badRequest("The symbol cannot be changed");
    }
    return HttpResponse.json({ ...trimmed(parsed.data), synced: existing.synced });
  }),

  http.delete(apiPath("/market-data/universe/:symbol"), ({ params }) => {
    const symbol = params["symbol"] as string;
    if (!mockUniverse.some((e) => e.symbol === symbol)) {
      return notFound(`${symbol} is not in the stock list`);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(apiPath("/market-data/instruments/sync"), () => {
    return HttpResponse.json({ synced: mockUniverse.map((e) => e.symbol), missing: [] });
  }),
];
