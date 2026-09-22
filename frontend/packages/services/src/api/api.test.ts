import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import {
  errorHandlers,
  handlers,
  mockAuditEntries,
  mockBacktestResults,
  mockBacktestRuns,
  mockBrokerAccounts,
  mockDataJobs,
  mockRateLimits,
  mockStrategies,
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
} from "./orbit";
import {
  getBrokerAccount,
  getDataJob,
  listAuditEntries,
  listBrokerAccounts,
  listDataJobs,
  listRateLimits,
} from "./relay";

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
    await expect(getStrategy(strategy.id)).resolves.toEqual(strategy);
    await expect(listBacktests()).resolves.toEqual(mockBacktestRuns);
    await expect(getBacktest(run.id)).resolves.toEqual(run);
    await expect(getBacktestResult(result.runId)).resolves.toEqual(result);
    await expect(listBacktestTrades(result.runId)).resolves.toEqual(
      mockTrades.filter((t) => t.runId === result.runId),
    );
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
    await expect(listDataJobs()).resolves.toEqual(mockDataJobs);
    await expect(getDataJob(job.id)).resolves.toEqual(job);
    await expect(listAuditEntries()).resolves.toEqual(mockAuditEntries);
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
  });
});
