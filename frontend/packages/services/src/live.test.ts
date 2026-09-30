import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { mockLiveTicks, liveHandlers } from "@nova/mocks";
import { getLiveDays, getLiveSnapshot } from "./api/live";
import { useLiveDays, useLiveSnapshot } from "./queries/live";
import { createQueryClient } from "./queries/queryClient";
import { connectRealtime, subscribeLiveTicks } from "./realtime";

class Socket {
  static CONNECTING = 0;
  static all: Socket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor() {
    Socket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
const server = setupServer(...liveHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
let disconnect: (() => void) | undefined;
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const stop of cleanup.splice(0)) stop();
  disconnect?.();
  disconnect = undefined;
  server.resetHandlers();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Socket.all = [];
});
function open() {
  vi.stubGlobal("WebSocket", Socket);
  disconnect = connectRealtime(createQueryClient());
  Socket.all[0]!.open();
  return Socket.all[0]!;
}

describe("live services", () => {
  it("fetches validated snapshots and day summaries", async () => {
    expect((await getLiveSnapshot(["TCS", "INFY"])).map((row) => row.symbol)).toEqual([
      "TCS",
      "INFY",
    ]);
    expect(await getLiveSnapshot([])).toEqual([]);
    expect((await getLiveDays("TCS"))[0]?.missingSeconds).toBe(100);
  });
  it("exposes query hooks with polling fallback", async () => {
    const client = createQueryClient();
    function wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client }, children);
    }
    const { result } = renderHook(
      () => ({ snapshot: useLiveSnapshot(["INFY"]).data, days: useLiveDays("INFY").data }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.snapshot?.[0]?.symbol).toBe("INFY"));
    await waitFor(() => expect(result.current.days).toHaveLength(2));
  });
  it("combines selections and dispatches ticks only to matching handlers", () => {
    const infy = vi.fn();
    const tcs = vi.fn();
    cleanup.push(subscribeLiveTicks(["INFY"], infy));
    const socket = open();
    const stopTcs = subscribeLiveTicks(["TCS"], tcs);
    cleanup.push(stopTcs);
    expect(socket.sent.at(-1)).toEqual({ type: "live.subscribe", symbols: ["INFY", "TCS"] });
    socket.message({ type: "live.tick", data: mockLiveTicks.find((row) => row.symbol === "INFY") });
    socket.message({ type: "live.tick", data: { symbol: "INFY", price: 1.5 } });
    expect(infy).toHaveBeenCalledTimes(1);
    expect(tcs).not.toHaveBeenCalled();
    stopTcs();
    expect(socket.sent.at(-1)).toEqual({ type: "live.subscribe", symbols: ["INFY"] });
  });
  it("resubscribes after reconnect and sends an empty selection on cleanup", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const stop = subscribeLiveTicks(["INFY"], vi.fn());
    cleanup.push(stop);
    const first = open();
    first.close();
    vi.advanceTimersByTime(1_000);
    const second = Socket.all[1]!;
    second.open();
    expect(second.sent.at(-1)).toEqual({ type: "live.subscribe", symbols: ["INFY"] });
    stop();
    expect(second.sent.at(-1)).toEqual({ type: "live.subscribe", symbols: [] });
  });
  it("rejects a combined selection over 500 without changing existing watchers", () => {
    cleanup.push(
      subscribeLiveTicks(
        Array.from({ length: 500 }, (_, i) => `S${i}`),
        vi.fn(),
      ),
    );
    expect(() => subscribeLiveTicks(["EXTRA"], vi.fn())).toThrow();
  });
});
