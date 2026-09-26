import { Fragment, createElement, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { RealtimeMessageSchema, type DataJob, type Page } from "@nova/contracts";
import { getApiBaseUrl, getDataMode } from "./config";
import { API_PREFIX } from "./http";
import { queryKeys } from "./queries/keys";
import { useSession } from "./session";

/**
 * One WebSocket to NOVA Core while signed in, real mode only (D57). `off`: no socket (mock mode or
 * signed out); `down`: lost, reconnecting. Screens poll while the status is not `open`.
 */
export type RealtimeStatus = "off" | "connecting" | "open" | "down";

export const RECONNECT_MS = { first: 1_000, max: 30_000, jitter: 500 };
/** A handshake that hangs (e.g. a stuck dev proxy) is closed and retried after this long. */
export const CONNECT_TIMEOUT_MS = 10_000;

let status: RealtimeStatus = "off";
const listeners = new Set<() => void>();

export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

function setStatus(next: RealtimeStatus): void {
  if (next === status) return;
  status = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(subscribe, getRealtimeStatus, () => "off");
}

/** True while screens must poll for job changes themselves. */
export function isPollingNeeded(): boolean {
  return status !== "open";
}

export function realtimeUrl(): string {
  const url = new URL(`${API_PREFIX}/ws`, getApiBaseUrl());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/** Puts a changed job into the detail cache, the loaded list pages and the latest-sync slot. */
export function applyJobUpdate(queryClient: QueryClient, job: DataJob): void {
  queryClient.setQueryData(queryKeys.dataJobs.detail(job.id), job);
  queryClient.setQueryData<InfiniteData<Page<DataJob>>>(queryKeys.dataJobs.list, (data) => {
    if (!data) return data;
    let found = false;
    const pages = data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => {
        if (item.id !== job.id) return item;
        found = true;
        return job;
      }),
    }));
    if (!found && pages[0]) pages[0] = { ...pages[0], items: [job, ...pages[0].items] };
    return { ...data, pages };
  });
  if (job.type === "instrument_sync") {
    queryClient.setQueryData<DataJob | null>(queryKeys.dataJobs.latestSync, (current) =>
      !current || current.id === job.id || current.createdAt <= job.createdAt ? job : current,
    );
  }
}

/** Drops a deleted job from the detail cache, the loaded list pages and the latest-sync slot. */
export function removeJobFromCache(queryClient: QueryClient, jobId: string): void {
  queryClient.removeQueries({ queryKey: queryKeys.dataJobs.detail(jobId), exact: true });
  queryClient.setQueryData<InfiniteData<Page<DataJob>>>(queryKeys.dataJobs.list, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== jobId),
          })),
        }
      : data,
  );
  queryClient.setQueryData<DataJob | null>(queryKeys.dataJobs.latestSync, (current) =>
    current?.id === jobId ? null : current,
  );
}

/**
 * Opens the socket and keeps it open (backoff 1 s → 30 s + jitter). Returns a function that closes
 * it for good. Events missed while down are fetched once on reconnect.
 */
export function connectRealtime(queryClient: QueryClient): () => void {
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let wasOpen = false;
  let stopped = false;

  const refreshJobs = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.dataJobs.all });

  const open = () => {
    setStatus(attempt === 0 && !wasOpen ? "connecting" : "down");
    const ws = new WebSocket(realtimeUrl());
    socket = ws;
    const hung = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) ws.close();
    }, CONNECT_TIMEOUT_MS);
    ws.onopen = () => {
      clearTimeout(hung);
      attempt = 0;
      setStatus("open");
      if (wasOpen) refreshJobs();
      wasOpen = true;
    };
    ws.onmessage = (event: MessageEvent) => {
      let raw: unknown;
      try {
        raw = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const parsed = RealtimeMessageSchema.safeParse(raw);
      if (!parsed.success) return;
      const message = parsed.data;
      if (message.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      else if (message.type === "data_job.updated") applyJobUpdate(queryClient, message.data);
      else if (message.type === "data_job.deleted")
        removeJobFromCache(queryClient, message.data.id);
    };
    ws.onclose = () => {
      clearTimeout(hung);
      if (stopped || socket !== ws) return;
      socket = null;
      if (status === "open") refreshJobs(); // polling takes over from the current state
      setStatus("down");
      const delay = Math.min(RECONNECT_MS.max, RECONNECT_MS.first * 2 ** attempt);
      attempt += 1;
      timer = setTimeout(open, delay + Math.random() * RECONNECT_MS.jitter);
    };
  };

  open();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket?.close();
    socket = null;
    setStatus("off");
  };
}

/** Keeps the socket open while someone is signed in (real mode). Place inside `QueryClientProvider`. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const signedIn = useSession() !== null;
  useEffect(() => {
    if (getDataMode() !== "real" || !signedIn) return undefined;
    return connectRealtime(queryClient);
  }, [queryClient, signedIn]);
  return createElement(Fragment, null, children);
}
