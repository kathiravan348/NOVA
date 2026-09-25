import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import {
  ApiErrorSchema,
  CandleSchema,
  InstrumentSchema,
  InstrumentSyncResultSchema,
  UniverseEntrySchema,
} from "@nova/contracts";
import { mockCandles, mockInstruments } from "../data";
import { marketDataHandlers } from "./marketData";
import { emptyHandlers, errorHandlers } from "./scenarios";

const server = setupServer(...marketDataHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const get = (path: string) => fetch(`http://localhost/api/v1${path}`);

describe("Market data MSW handlers", () => {
  it("GET /market-data/instruments returns the instruments", async () => {
    const res = await get("/market-data/instruments");
    expect(res.status).toBe(200);
    expect(InstrumentSchema.array().parse(await res.json())).toEqual(mockInstruments);
  });

  it("GET /market-data/candles returns the series for symbol and timeframe", async () => {
    const res = await get("/market-data/candles?symbol=RELIANCE&timeframe=5m");
    expect(res.status).toBe(200);
    expect(CandleSchema.array().parse(await res.json())).toEqual(mockCandles["RELIANCE:5m"]);
  });

  it("returns [] for a timeframe the instrument has no data for", async () => {
    const res = await get("/market-data/candles?symbol=TCS&timeframe=1h");
    expect(await res.json()).toEqual([]);
  });

  it("returns 404 for an unknown symbol or missing params", async () => {
    for (const path of [
      "/market-data/candles?symbol=NOPE&timeframe=1d",
      "/market-data/candles?symbol=TCS",
    ]) {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("not_found");
    }
  });

  it("has empty and error scenarios", async () => {
    server.use(...emptyHandlers);
    expect(await (await get("/market-data/instruments")).json()).toEqual([]);
    server.use(...errorHandlers);
    expect((await get("/market-data/candles?symbol=TCS&timeframe=1d")).status).toBe(500);
  });

  it("GET /market-data/universe lists every mock stock as synced, by symbol", async () => {
    const res = await get("/market-data/universe");
    expect(res.status).toBe(200);
    const rows = UniverseEntrySchema.array().parse(await res.json());
    expect(rows).toHaveLength(mockInstruments.length);
    expect(rows.every((r) => r.synced)).toBe(true);
    expect(rows.map((r) => r.symbol)).toEqual(rows.map((r) => r.symbol).sort());
  });

  describe("stock-list writes", () => {
    const send = (method: string, path: string, body?: unknown) =>
      fetch(`http://localhost/api/v1/market-data/${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const entry = { symbol: "M&M", name: " Mahindra ", sector: "Automobile", indices: [] };

    it("adds a new stock, not synced, and refuses duplicates or bad bodies", async () => {
      const res = await send("POST", "universe", entry);
      expect(res.status).toBe(201);
      expect(UniverseEntrySchema.parse(await res.json())).toMatchObject({
        name: "Mahindra",
        synced: false,
      });
      const dup = await send("POST", "universe", { ...entry, symbol: mockInstruments[0]!.symbol });
      expect(ApiErrorSchema.parse(await dup.json()).error.message).toContain("already");
      expect((await send("POST", "universe", { ...entry, symbol: "m&m" })).status).toBe(400);
    });

    it("edits and removes known stocks, 404 for unknown ones", async () => {
      const known = mockInstruments[0]!.symbol;
      const edit = await send("PUT", `universe/${known}`, { ...entry, symbol: known });
      expect(edit.status).toBe(200);
      expect((await send("PUT", `universe/${known}`, entry)).status).toBe(400);
      expect((await send("DELETE", `universe/${known}`)).status).toBe(204);
      expect((await send("DELETE", "universe/NOPE")).status).toBe(404);
    });

    it("syncs every mock stock", async () => {
      const res = await send("POST", "instruments/sync");
      expect(InstrumentSyncResultSchema.parse(await res.json()).missing).toEqual([]);
    });
  });
});
