import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClientProvider, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import type { DataJob, Page } from "@nova/contracts";
import { handlers, mockDataJobs } from "@nova/mocks";
import { queryKeys } from "./queries/keys";
import { createQueryClient } from "./queries/queryClient";
import { JOB_POLL_MS, useDataJob, useDataJobs } from "./queries/relay";
import {
  CONNECT_TIMEOUT_MS,
  RECONNECT_MS,
  applyJobUpdate,
  connectRealtime,
  getRealtimeStatus,
  realtimeUrl,
} from "./realtime";

class FakeSocket {
  static CONNECTING = 0;
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(text: string) {
    this.sent.push(text);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  message(value: unknown) {
    this.onmessage?.({ data: typeof value === "string" ? value : JSON.stringify(value) });
  }
  static last(): FakeSocket {
    return FakeSocket.all[FakeSocket.all.length - 1]!;
  }
}

const server = setupServer(...handlers);
let requests: string[] = [];
server.events.on("request:start", ({ request }) => {
  requests.push(new URL(request.url).pathname);
});
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

const running = mockDataJobs.find((job) => job.status === "running")!;
let disconnect: (() => void) | undefined;

beforeEach(() => {
  FakeSocket.all = [];
  requests = [];
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  disconnect?.();
  disconnect = undefined;
  server.resetHandlers();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("realtime client", () => {
  it("builds the socket URL from the page origin", () => {
    expect(realtimeUrl()).toMatch(/^wss?:\/\/.+\/api\/v1\/ws$/);
  });

  it("updates the job list and the job page without a fetch", async () => {
    const client = createQueryClient();
    // Read `data` in render: TanStack Query re-renders only for the fields a component uses.
    const { result } = renderHook(
      () => ({ list: useDataJobs().data, job: useDataJob(running.id).data }),
      { wrapper: wrapperFor(client) },
    );
    await waitFor(() => expect(result.current.job).toBeDefined());
    await waitFor(() => expect(result.current.list).toBeDefined());
    disconnect = connectRealtime(client);
    FakeSocket.last().open();
    requests = [];

    const done: DataJob = {
      ...running,
      status: "completed",
      progressPercent: 100,
      finishedAt: "2026-09-26T10:00:00Z",
    };
    act(() => FakeSocket.last().message({ type: "data_job.updated", data: done }));

    await waitFor(() => expect(result.current.job?.status).toBe("completed"));
    expect(result.current.list?.find((job) => job.id === running.id)?.status).toBe("completed");
    expect(requests).toEqual([]);
  });

  it("puts a new job at the top of the first page", () => {
    const client = createQueryClient();
    const page: Page<DataJob> = { items: [running], nextCursor: null };
    client.setQueryData<InfiniteData<Page<DataJob>>>(queryKeys.dataJobs.list, {
      pages: [page],
      pageParams: [undefined],
    });
    const fresh: DataJob = { ...running, id: "job-new", status: "queued", startedAt: null };

    applyJobUpdate(client, fresh);

    const data = client.getQueryData<InfiniteData<Page<DataJob>>>(queryKeys.dataJobs.list);
    expect(data?.pages[0]?.items.map((job) => job.id)).toEqual(["job-new", running.id]);
  });

  it("ignores invalid messages and answers ping with pong", () => {
    const client = createQueryClient();
    disconnect = connectRealtime(client);
    const socket = FakeSocket.last();
    socket.open();

    socket.message("not json");
    socket.message({ type: "data_job.updated", data: { id: "broken" } });
    socket.message({ type: "ping" });

    expect(client.getQueryData(queryKeys.dataJobs.detail("broken"))).toBeUndefined();
    expect(socket.sent).toEqual([JSON.stringify({ type: "pong" })]);
    expect(getRealtimeStatus()).toBe("open");
  });

  it("reconnects with a growing delay and refreshes jobs once back", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    disconnect = connectRealtime(client);
    expect(getRealtimeStatus()).toBe("connecting");
    FakeSocket.last().open();

    FakeSocket.last().close();
    expect(getRealtimeStatus()).toBe("down");
    vi.advanceTimersByTime(RECONNECT_MS.first - 1);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(2);

    FakeSocket.last().close(); // second failure waits twice as long
    vi.advanceTimersByTime(RECONNECT_MS.first * 2 - 1);
    expect(FakeSocket.all).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(3);

    invalidate.mockClear();
    FakeSocket.last().open();
    expect(getRealtimeStatus()).toBe("open");
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dataJobs.all });

    disconnect();
    disconnect = undefined;
    expect(getRealtimeStatus()).toBe("off");
  });

  it("removes a deleted job from the list and its page", () => {
    const client = createQueryClient();
    const page: Page<DataJob> = { items: [running], nextCursor: null };
    client.setQueryData<InfiniteData<Page<DataJob>>>(queryKeys.dataJobs.list, {
      pages: [page],
      pageParams: [undefined],
    });
    client.setQueryData(queryKeys.dataJobs.detail(running.id), running);
    disconnect = connectRealtime(client);
    FakeSocket.last().open();

    FakeSocket.last().message({ type: "data_job.deleted", data: { id: running.id } });

    const data = client.getQueryData<InfiniteData<Page<DataJob>>>(queryKeys.dataJobs.list);
    expect(data?.pages[0]?.items).toEqual([]);
    expect(client.getQueryData(queryKeys.dataJobs.detail(running.id))).toBeUndefined();
  });

  it("closes a handshake that hangs and tries again", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    disconnect = connectRealtime(createQueryClient());

    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS);
    expect(FakeSocket.all[0]!.readyState).toBe(3);
    expect(getRealtimeStatus()).toBe("down");
    vi.advanceTimersByTime(RECONNECT_MS.first);
    expect(FakeSocket.all).toHaveLength(2);
    FakeSocket.last().open();
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS);
    expect(getRealtimeStatus()).toBe("open");
  });

  it("polls an active job only while the socket is not open", async () => {
    const original = JOB_POLL_MS.detail;
    JOB_POLL_MS.detail = 40;
    try {
      const path = `/api/v1/data-jobs/${running.id}`;
      const count = () => requests.filter((p) => p === path).length;

      const polling = renderHook(() => useDataJob(running.id), {
        wrapper: wrapperFor(createQueryClient()),
      });
      await waitFor(() => expect(count()).toBeGreaterThanOrEqual(3));
      polling.unmount();

      const client = createQueryClient();
      disconnect = connectRealtime(client);
      FakeSocket.last().open();
      requests = [];
      const live = renderHook(() => useDataJob(running.id), { wrapper: wrapperFor(client) });
      await waitFor(() => expect(live.result.current.isSuccess).toBe(true));
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(count()).toBe(1);
    } finally {
      JOB_POLL_MS.detail = original;
    }
  });
});
