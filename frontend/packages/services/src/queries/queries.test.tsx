import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import {
  errorHandlers,
  handlers,
  mockAuditEntries,
  mockBacktestResults,
  mockBrokerAccounts,
  mockBrokerProfiles,
  mockDataJobs,
  mockRateLimits,
  mockStrategies,
  mockUser,
} from "@nova/mocks";
import { ApiRequestError } from "../http";
import { queryKeys } from "./keys";
import { useBacktestResults, useMe, useStrategies, useStrategy } from "./orbit";
import { createQueryClient, shouldRetry } from "./queryClient";
import {
  useAuditEntries,
  useBrokerAccount,
  useBrokerAccounts,
  useBrokerProfile,
  useBrokerProfiles,
  useUpdateRateLimit,
  useDataJobs,
  useRateLimits,
} from "./relay";

const server = setupServer(...handlers);
let requests: string[] = [];
server.events.on("request:start", ({ request }) => {
  requests.push(new URL(request.url).pathname);
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  requests = [];
});
afterAll(() => server.close());

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

describe("query hooks", () => {
  it("useStrategies resolves to the mock", async () => {
    const { result } = renderHook(() => useStrategies(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStrategies);
  });

  it("useMe and relay list hooks resolve to their mocks", async () => {
    const { result } = renderHook(
      () => ({
        me: useMe(),
        accounts: useBrokerAccounts(),
        limits: useRateLimits(),
        jobs: useDataJobs(),
        audit: useAuditEntries(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.audit.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.me.isSuccess).toBe(true));
    expect(result.current.me.data).toEqual(mockUser);
    await waitFor(() => expect(result.current.jobs.isSuccess).toBe(true));
    expect(result.current.accounts.data).toEqual(mockBrokerAccounts);
    expect(result.current.limits.data).toEqual(mockRateLimits);
    expect(result.current.jobs.data).toEqual(mockDataJobs);
    expect(result.current.audit.data).toEqual(mockAuditEntries);
  });

  it("useBacktestResults resolves one result per id", async () => {
    const ids = mockBacktestResults.map((r) => r.runId);
    const { result } = renderHook(() => useBacktestResults(ids), { wrapper });
    await waitFor(() => expect(result.current.every((q) => q.isSuccess)).toBe(true));
    expect(result.current.map((q) => q.data)).toEqual(mockBacktestResults);
  });

  it("useStrategy('') stays idle and never fetches", () => {
    const { result } = renderHook(() => useStrategy(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toEqual([]);
  });

  it("a 404 sets isError without retrying", async () => {
    const { result } = renderHook(() => useStrategy("nope"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 404, code: "not_found" });
    expect(requests).toEqual(["/api/v1/strategies/nope"]);
  });

  it("a 500 scenario sets isError", async () => {
    server.use(...errorHandlers);
    const { result } = renderHook(() => useBrokerAccount(mockBrokerAccounts[0]!.id), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4000 });
    expect(result.current.error).toMatchObject({ code: "internal" });
  });

  it("useBrokerProfiles and useBrokerProfile resolve to the mock", async () => {
    const { result } = renderHook(
      () => ({ list: useBrokerProfiles(), one: useBrokerProfile("zerodha") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.one.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(result.current.list.data).toEqual(mockBrokerProfiles);
    expect(result.current.one.data).toEqual(mockBrokerProfiles[0]);
  });

  it("useUpdateRateLimit sends a PATCH and refetches rate limits", async () => {
    const { result } = renderHook(
      () => ({ limits: useRateLimits(), update: useUpdateRateLimit() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.limits.isSuccess).toBe(true));
    requests = [];
    await result.current.update.mutateAsync({
      accountId: "brk_001",
      endpoint: "orders",
      window: "day",
      novaLimit: 4500,
    });
    await waitFor(() => expect(requests).toContain("/api/v1/broker/rate-limits"));
    expect(requests[0]).toBe("/api/v1/broker/rate-limits/brk_001/orders");
  });
});

describe("shouldRetry and keys", () => {
  it("never retries 4xx and retries other errors once", () => {
    expect(shouldRetry(0, new ApiRequestError(404, "not_found", "x"))).toBe(false);
    expect(shouldRetry(0, new ApiRequestError(500, "internal", "x"))).toBe(true);
    expect(shouldRetry(1, new ApiRequestError(500, "internal", "x"))).toBe(false);
  });

  it("builds nested keys", () => {
    expect(queryKeys.backtests.result("run_001")).toEqual(["backtests", "run_001", "result"]);
    expect(queryKeys.strategies.detail("s1")).toEqual(["strategies", "s1"]);
  });
});
