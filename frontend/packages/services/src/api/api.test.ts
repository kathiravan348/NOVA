import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  errorHandlers,
  handlers,
  mockAuditEntries,
  mockBacktestResults,
  mockBacktestRuns,
  mockBrokerAccounts,
  mockBrokerProfiles,
  mockCandles,
  mockDataJobs,
  mockInstruments,
  mockRateLimits,
  mockStrategies,
  mockStrategyStats,
  mockTrades,
  mockUser,
} from "@nova/mocks";
import {
  getBacktest,
  getBacktestResult,
  getMe,
  getStrategy,
  listBacktests,
  listBacktestTrades,
  listStrategies,
  listStrategyStats,
} from "./orbit";
import {
  getBrokerAccount,
  getBrokerProfile,
  listBrokerProfiles,
  updateRateLimit,
  getDataJob,
  listAuditEntries,
  listBrokerAccounts,
  listDataJobs,
  listRateLimits,
} from "./relay";
import { listCandles, listInstruments } from "./marketData";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const strategy = mockStrategies[0]!;
const run = mockBacktestRuns[0]!;
const result = mockBacktestResults[0]!;
const account = mockBrokerAccounts[0]!;
const job = mockDataJobs[0]!;

describe("Orbit api", () => {
  it("returns the mock for every endpoint", async () => {
    await expect(getMe()).resolves.toEqual(mockUser);
    await expect(listStrategies()).resolves.toEqual(mockStrategies);
    await expect(listStrategyStats()).resolves.toEqual(mockStrategyStats);
    await expect(getStrategy(strategy.id)).resolves.toEqual(strategy);
    await expect(listBacktests()).resolves.toEqual({ items: mockBacktestRuns, nextCursor: null });
    await expect(getBacktest(run.id)).resolves.toEqual(run);
    await expect(getBacktestResult(result.runId)).resolves.toEqual(result);
    await expect(listBacktestTrades(result.runId)).resolves.toEqual({
      items: mockTrades.filter((t) => t.runId === result.runId),
      nextCursor: null,
    });
  });

  it("sends strategyId, limit and cursor as query parameters", async () => {
    const strategyId = run.strategyId;
    const first = await listBacktests({ strategyId, limit: 1 });
    expect(first.items).toEqual([mockBacktestRuns.find((r) => r.strategyId === strategyId)]);
    const all = mockBacktestRuns.filter((r) => r.strategyId === strategyId);
    if (all.length > 1) {
      const next = await listBacktests({ strategyId, limit: 1, cursor: first.nextCursor! });
      expect(next.items).toEqual([all[1]]);
    }
    await expect(listBacktests({ limit: 0 })).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
    });
  });

  it("rejects a bare array where a page is expected", async () => {
    server.use(http.get("*/api/v1/audit", () => HttpResponse.json(mockAuditEntries)));
    await expect(listAuditEntries()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("maps an unknown id to a 404 not_found error", async () => {
    await expect(getStrategy("nope")).rejects.toMatchObject({ status: 404, code: "not_found" });
    await expect(getBacktest("nope")).rejects.toMatchObject({ status: 404, code: "not_found" });
    await expect(getBacktestResult("nope")).rejects.toMatchObject({ code: "not_found" });
    await expect(listBacktestTrades("nope")).rejects.toMatchObject({ code: "not_found" });
  });

  it("maps error scenarios to code internal", async () => {
    server.use(...errorHandlers);
    await expect(listStrategies()).rejects.toMatchObject({ status: 500, code: "internal" });
    await expect(getMe()).rejects.toMatchObject({ status: 500, code: "internal" });
  });
});

describe("Relay api", () => {
  it("returns the mock for every endpoint", async () => {
    await expect(listBrokerAccounts()).resolves.toEqual(mockBrokerAccounts);
    await expect(getBrokerAccount(account.id)).resolves.toEqual(account);
    await expect(listRateLimits()).resolves.toEqual(mockRateLimits);
    await expect(listDataJobs()).resolves.toEqual({ items: mockDataJobs, nextCursor: null });
    await expect(getDataJob(job.id)).resolves.toEqual(job);
    await expect(listAuditEntries()).resolves.toEqual({
      items: mockAuditEntries,
      nextCursor: null,
    });
  });

  it("maps an unknown id to a 404 not_found error", async () => {
    await expect(getBrokerAccount("nope")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
    await expect(getDataJob("nope")).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  it("maps error scenarios to code internal", async () => {
    server.use(...errorHandlers);
    await expect(listAuditEntries()).rejects.toMatchObject({ status: 500, code: "internal" });
    await expect(listBrokerProfiles()).rejects.toMatchObject({ status: 500, code: "internal" });
  });

  it("returns broker profiles and 404 for an unknown broker", async () => {
    await expect(listBrokerProfiles()).resolves.toEqual(mockBrokerProfiles);
    await expect(getBrokerProfile("zerodha")).resolves.toEqual(mockBrokerProfiles[0]);
    await expect(getBrokerProfile("nope")).rejects.toMatchObject({ code: "not_found" });
  });

  it("updateRateLimit resolves on 204 and maps 400 to invalid_request", async () => {
    await expect(
      updateRateLimit("brk_001", "orders", { window: "minute", novaLimit: 300 }),
    ).resolves.toBeUndefined();
    await expect(
      updateRateLimit("brk_001", "orders", { window: "minute", novaLimit: 401 }),
    ).rejects.toMatchObject({ status: 400, code: "invalid_request" });
  });
});

describe("Market data api", () => {
  it("returns instruments and candles from the mocks", async () => {
    await expect(listInstruments()).resolves.toEqual(mockInstruments);
    await expect(listCandles("INFY", "1d")).resolves.toEqual(mockCandles["INFY:1d"]);
  });

  it("maps an unknown symbol to not_found", async () => {
    await expect(listCandles("NOPE", "1d")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });
});
