import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { ApiErrorSchema, CandleSchema, InstrumentSchema } from "@nova/contracts";
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
});
