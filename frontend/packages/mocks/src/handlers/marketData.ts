import { http, HttpResponse } from "msw";
import {
  UniverseEntryWriteSchema,
  type DataJob,
  type MarketIndex,
  type UniverseEntry,
} from "@nova/contracts";
import {
  mockCandles,
  mockCoverageDetails,
  mockCoverageLists,
  mockInstruments,
  mockUnavailableDays,
} from "../data";
import { apiPath, badRequest, notFound, paginate } from "./api";

/** Two demo IPOs: new listings a sync found (D56). They have no candles yet. */
const demoNewListings: UniverseEntry[] = [
  {
    symbol: "NOVATECH",
    name: "Novatech Systems",
    sector: "Unclassified",
    indices: [],
    synced: true,
    newListing: true,
  },
  {
    symbol: "GREENGRID-SM",
    name: "GREENGRID ENERGY",
    sector: "Unclassified",
    indices: [],
    synced: true,
    newListing: true,
  },
];

/** The mock stock list: every mock instrument (synced with Kite) and two new listings. */
export const mockUniverse: UniverseEntry[] = [
  ...mockInstruments.map((i) => ({
    symbol: i.symbol,
    name: i.name,
    sector: i.sector,
    indices: i.indices,
    synced: true,
    newListing: false,
  })),
  ...demoNewListings,
].sort((a, b) => a.symbol.localeCompare(b.symbol));

/** The 19 NSE indices of migration 0009, with member counts in the mock list. */
const INDEX_NAMES = [
  "NIFTY 50",
  "NIFTY NEXT 50",
  "NIFTY 100",
  "NIFTY 200",
  "NIFTY 500",
  "NIFTY MIDCAP 100",
  "NIFTY SMLCAP 100",
  "NIFTY BANK",
  "NIFTY FIN SERVICE",
  "NIFTY IT",
  "NIFTY AUTO",
  "NIFTY FMCG",
  "NIFTY PHARMA",
  "NIFTY METAL",
  "NIFTY REALTY",
  "NIFTY ENERGY",
  "NIFTY MEDIA",
  "NIFTY PSU BANK",
  "NIFTY PVT BANK",
];
export const mockMarketIndices: MarketIndex[] = INDEX_NAMES.map((name) => ({
  name,
  kiteSymbol: name,
  members: mockUniverse.filter((e) => e.indices.includes(name)).length,
  updatedAt: "2026-09-26T03:20:00Z",
})).sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));

const trimmed = (e: Omit<UniverseEntry, "synced" | "newListing">) => ({
  ...e,
  name: e.name.trim(),
  sector: e.sector.trim(),
});

export const marketDataHandlers = [
  http.get(apiPath("/market-data/unavailable"), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const timeframe = params.get("timeframe") ?? "1d";
    const status = params.get("status") ?? "unavailable";
    if (!["1m", "1d"].includes(timeframe) || !["all", "unavailable", "resolved"].includes(status))
      return badRequest("Invalid filter");
    return paginate(
      mockUnavailableDays.filter(
        (r) =>
          r.timeframe === timeframe &&
          (status === "all" || r.status === status) &&
          (!params.get("symbol") || r.symbol === params.get("symbol")) &&
          (!params.get("from") || r.day >= params.get("from")!) &&
          (!params.get("to") || r.day <= params.get("to")!),
      ),
      request.url,
    );
  }),
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

  http.get(apiPath("/market-data/indices"), () => {
    return HttpResponse.json(mockMarketIndices);
  }),

  // Demo: the stored lists ignore the asked period but echo it (D63).
  http.get(apiPath("/market-data/coverage"), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const list = mockCoverageLists.find((l) => l.timeframe === (params.get("timeframe") ?? "1d"));
    if (!list) return badRequest("Timeframe must be 1m or 1d");
    const pageResponse = paginate(list.rows, request.url);
    if (pageResponse.status !== 200) return pageResponse;
    const offset = Number(params.get("offset") ?? 0);
    const limit = Number(params.get("limit") ?? 50);
    return HttpResponse.json({
      ...list,
      rows: list.rows.slice(offset, offset + limit),
      total: list.rows.length,
      from: params.get("from") ?? list.from,
      to: params.get("to") ?? list.to,
    });
  }),

  http.get(apiPath("/market-data/coverage/:symbol"), ({ params, request }) => {
    const symbol = decodeURIComponent(params["symbol"] as string);
    const timeframe = new URL(request.url).searchParams.get("timeframe") ?? "1d";
    const found = mockCoverageDetails.find((d) => d.symbol === symbol && d.timeframe === timeframe);
    if (found) return HttpResponse.json(found);
    const row = mockCoverageLists
      .find((l) => l.timeframe === timeframe)
      ?.rows.find((r) => r.symbol === symbol);
    if (!row) return notFound(`${symbol} is not in the stock list`);
    const list = mockCoverageLists.find((l) => l.timeframe === timeframe)!;
    return HttpResponse.json({
      symbol,
      timeframe,
      from: list.from,
      to: list.to,
      firstDay: row.firstDay,
      lastDay: row.lastDay,
      days: row.days,
      missingDays: 0,
      missing: [],
    });
  }),

  // Demo: answers as seen without storing it.
  http.post(apiPath("/market-data/universe/:symbol/clear-new"), ({ params }) => {
    const entry = mockUniverse.find((e) => e.symbol === params["symbol"]);
    if (!entry) return notFound(`${String(params["symbol"])} is not in the stock list`);
    return HttpResponse.json({ ...entry, newListing: false } satisfies UniverseEntry);
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
    const entry: UniverseEntry = { ...trimmed(parsed.data), synced: false, newListing: false };
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
    return HttpResponse.json({
      ...trimmed(parsed.data),
      synced: existing.synced,
      newListing: existing.newListing,
    });
  }),

  http.delete(apiPath("/market-data/universe/:symbol"), ({ params }) => {
    const symbol = params["symbol"] as string;
    if (!mockUniverse.some((e) => e.symbol === symbol)) {
      return notFound(`${symbol} is not in the stock list`);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Queues an instrument sync (D56); the mock job is not stored.
  http.post(apiPath("/market-data/instruments/sync"), () => {
    const job: DataJob = {
      id: "job_sync_demo",
      syncResult: null,
      type: "instrument_sync",
      status: "queued",
      exchange: "NSE",
      segment: "equity_delivery",
      symbols: [],
      timeframe: null,
      from: null,
      to: null,
      progressPercent: 0,
      rowsWritten: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      error: null,
      summary: null,
      mode: null,
      plan: null,
      stepsDone: 0,
      stepsTotal: 0,
      expiresAt: null,
    };
    return HttpResponse.json(job, { status: 202 });
  }),
];
