import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  errorHandlers,
  handlers,
  mockAuditEntries,
  mockBacktestResults,
  mockBacktestRuns,
  paginate,
  mockBrokerAccounts,
  mockBrokerProfiles,
  mockDataJobs,
  mockRateLimits,
  mockStrategies,
  mockStrategyStats,
  mockUser,
} from "@nova/mocks";
import { ApiRequestError } from "../http";
import { queryKeys } from "./keys";
import {
  RUN_POLL_MS,
  useBacktest,
  useBacktestResults,
  useBacktests,
  useMe,
  useStrategies,
  useStrategy,
  useStrategyStats,
} from "./orbit";
import { useSyncInstruments, useUniverse } from "./marketData";
import { createQueryClient, shouldRetry } from "./queryClient";
import {
  useAuditEntries,
  useBrokerAccount,
  useBrokerAccounts,
  useFinishKiteLogin,
  useKiteApp,
  useSaveKiteKeys,
  useBrokerProfile,
  useBrokerProfiles,
  useCancelDataJob,
  useCreateArchiveJob,
  useRecorder,
  useUpdateRecorder,
  useCreateDataJob,
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

  it("useStrategyStats resolves to the mock", async () => {
    const { result } = renderHook(() => useStrategyStats(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStrategyStats);
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

  it("paged hooks load the next page and keep data flat", async () => {
    // Serve two runs per page so the mock list spans more than one page.
    server.use(
      http.get("*/api/v1/backtests", ({ request }) => {
        const url = new URL(request.url);
        if (!url.searchParams.has("limit")) url.searchParams.set("limit", "2");
        return paginate(mockBacktestRuns, url.toString());
      }),
    );
    const { result } = renderHook(() => useBacktests(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockBacktestRuns.slice(0, 2));
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data).toEqual(mockBacktestRuns.slice(0, 4)));
  });

  it("useBacktests({ strategyId }) sends the filter", async () => {
    const strategyId = mockBacktestRuns[0]!.strategyId;
    const { result } = renderHook(() => useBacktests({ strategyId }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(
      mockBacktestRuns.filter((r) => r.strategyId === strategyId),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it("useBacktestResults resolves one result per id", async () => {
    const ids = mockBacktestResults.map((r) => r.runId);
    const { result } = renderHook(() => useBacktestResults(ids), { wrapper });
    await waitFor(() => expect(result.current.every((q) => q.isSuccess)).toBe(true));
    expect(result.current.map((q) => q.data)).toEqual(mockBacktestResults);
  });

  it("useBacktest polls a running run until it completes, then refreshes lists and stats", async () => {
    const completed = mockBacktestRuns.find((r) => r.id === "run_001")!;
    const running = { ...completed, status: "running", finishedAt: null };
    let calls = 0;
    server.use(
      http.get("*/api/v1/backtests/run_001", () => {
        calls += 1;
        return HttpResponse.json(calls < 3 ? running : completed);
      }),
    );
    const client = createQueryClient();
    client.setQueryData(queryKeys.strategies.stats, mockStrategyStats);
    client.setQueryData(queryKeys.backtests.list({}), { pages: [], pageParams: [] });
    const original = RUN_POLL_MS.detail;
    RUN_POLL_MS.detail = 20;
    try {
      const { result } = renderHook(() => useBacktest("run_001"), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      });
      await waitFor(() => expect(result.current.data?.status).toBe("completed"));
      expect(client.getQueryState(queryKeys.strategies.stats)?.isInvalidated).toBe(true);
      expect(client.getQueryState(queryKeys.backtests.list({}))?.isInvalidated).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(calls).toBe(3); // no polling once completed
    } finally {
      RUN_POLL_MS.detail = original;
    }
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

  it("useCreateDataJob posts a download and refetches the jobs list", async () => {
    const { result } = renderHook(() => ({ jobs: useDataJobs(), create: useCreateDataJob() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.jobs.isSuccess).toBe(true));
    requests = [];
    const job = await result.current.create.mutateAsync({
      symbols: ["INFY"],
      timeframe: "1d",
      from: "2025-01-01",
      to: "2025-12-31",
    });
    expect(job.status).toBe("queued");
    await waitFor(() => expect(requests).toContain("/api/v1/data-jobs"));
  });

  it("useCancelDataJob posts the cancel and stores the cancelled job", async () => {
    const { result } = renderHook(() => useCancelDataJob(), { wrapper });
    const job = await result.current.mutateAsync("job_002");
    expect(job.status).toBe("cancelled");
    expect(requests).toContain("/api/v1/data-jobs/job_002/cancel");
  });

  it("useUniverse lists the stock list", async () => {
    const { result } = renderHook(() => useUniverse(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.length).toBeGreaterThan(0);
  });

  it("useUpdateRecorder saves the switch and useRecorder shows it", async () => {
    const { result } = renderHook(
      () => ({ recorder: useRecorder(), update: useUpdateRecorder() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.recorder.isSuccess).toBe(true));
    await result.current.update.mutateAsync({ enabled: true, symbols: [] });
    await waitFor(() => expect(result.current.recorder.data?.enabled).toBe(true));
    await result.current.update.mutateAsync({ enabled: false, symbols: [] });
  });

  it("useSaveKiteKeys stores the answered app and refetches the accounts (D55)", async () => {
    const { result } = renderHook(
      () => ({ app: useKiteApp("brk_003"), save: useSaveKiteKeys("brk_003") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.app.data?.secretSaved).toBe(false));
    await result.current.save.mutateAsync({
      apiKey: "newkeyZX90",
      apiSecret: "s3cret",
      passphrase: "long enough passphrase",
    });
    await waitFor(() => expect(result.current.app.data?.apiKeyLast4).toBe("ZX90"));
  });

  it("keeps no passphrase in the mutation cache after reset (D55)", async () => {
    const client = createQueryClient();
    const own = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useFinishKiteLogin("brk_002"), { wrapper: own });
    await result.current.mutateAsync({ passphrase: "secret passphrase 1" });
    result.current.reset();
    await waitFor(() =>
      expect(
        JSON.stringify(
          client
            .getMutationCache()
            .getAll()
            .map((m) => m.state),
        ),
      ).not.toContain("secret passphrase 1"),
    );
  });

  it("useFinishKiteLogin posts the passphrase and refetches the accounts", async () => {
    const { result } = renderHook(() => useFinishKiteLogin("brk_002"), { wrapper });
    requests = [];
    await result.current.mutateAsync({ passphrase: "any" });
    expect(requests).toContain("/api/v1/broker/accounts/brk_002/login/finish");
  });

  it("useCreateArchiveJob queues an archive", async () => {
    const { result } = renderHook(() => useCreateArchiveJob(), { wrapper });
    const job = await result.current.mutateAsync({ before: "2026-09-01" });
    expect(job.type).toBe("archive");
  });

  it("useSyncInstruments queues a sync job", async () => {
    const { result } = renderHook(() => ({ list: useUniverse(), sync: useSyncInstruments() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    requests = [];
    const job = await result.current.sync.mutateAsync();
    expect(job.type).toBe("instrument_sync");
    expect(requests[0]).toBe("/api/v1/market-data/instruments/sync");
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
    expect(queryKeys.backtests.list({ strategyId: "s1" })).toEqual([
      "backtests",
      "list",
      { strategyId: "s1" },
    ]);
  });
});
