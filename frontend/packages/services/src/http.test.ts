import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { UserSchema } from "@nova/contracts";
import { apiPath, handlers, mockUser } from "@nova/mocks";
import { getApiBaseUrl, getDataMode } from "./config";
import { apiGet, apiPost, apiRequest, apiSend, ApiRequestError } from "./http";
import { shouldRetry, createQueryClient } from "./queries/queryClient";
import {
  listApprovals,
  approveRequest,
  rejectRequest,
  getAgentAccount,
  createAgentAccount,
  updateAgentAccess,
  updateAgentPassword,
} from "./api/relay";
import { createElement, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useAgentAccount,
  useApprovals,
  useApproveRequest,
  useRejectRequest,
  useCreateAgentAccount,
  useUpdateAgentAccess,
  useUpdateAgentPassword,
} from "./queries/approvals";
import { queryKeys } from "./queries/keys";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

describe("config", () => {
  it("defaults to mock mode", () => {
    vi.stubEnv("VITE_DATA_MODE", "");
    expect(getDataMode()).toBe("mock");
    expect(getApiBaseUrl()).toBe(globalThis.location.origin);
  });

  it("uses the same origin in real mode (D48)", () => {
    vi.stubEnv("VITE_DATA_MODE", "real");
    expect(getDataMode()).toBe("real");
    expect(getApiBaseUrl()).toBe(globalThis.location.origin);
  });

  it("throws on an unknown mode", () => {
    vi.stubEnv("VITE_DATA_MODE", "staging");
    expect(() => getDataMode()).toThrow("Unknown VITE_DATA_MODE");
  });
});

describe("apiGet", () => {
  it("returns parsed data on 2xx", async () => {
    await expect(apiGet("/me", UserSchema)).resolves.toEqual(mockUser);
  });

  it("throws invalid_response when the body does not match the schema", async () => {
    server.use(http.get(apiPath("/me"), () => HttpResponse.json({})));
    await expect(apiGet("/me", UserSchema)).rejects.toMatchObject({
      status: 200,
      code: "invalid_response",
    });
  });

  it("falls back to code internal when an error body is not an ApiError", async () => {
    server.use(http.get(apiPath("/me"), () => new HttpResponse("oops", { status: 502 })));
    await expect(apiGet("/me", UserSchema)).rejects.toMatchObject({
      status: 502,
      code: "internal",
    });
  });

  it("throws network when fetch rejects", async () => {
    server.use(http.get(apiPath("/me"), () => HttpResponse.error()));
    const err: unknown = await apiGet("/me", UserSchema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 0, code: "network" });
  });

  it("fetches the same endpoint in real mode", async () => {
    vi.stubEnv("VITE_DATA_MODE", "real");
    await expect(apiGet("/me", UserSchema)).resolves.toEqual(mockUser);
  });

  it("apiPost validates the JSON answer", async () => {
    const body = { email: "a@b.co", password: "pw" };
    await expect(apiPost("/auth/login", body, UserSchema)).resolves.toEqual(mockUser);
    await expect(apiPost("/auth/login", {}, UserSchema)).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
    });
  });
});

describe("held writes", () => {
  it.each(["json", "empty"])("reports held %s responses and never retries", async (kind) => {
    server.use(
      http.post(
        apiPath("/held"),
        () =>
          new HttpResponse(null, {
            status: 202,
            headers: { "x-nova-approval": "approval_123" },
          }),
      ),
    );
    const result: unknown = await (
      kind === "json" ? apiRequest("POST", "/held", {}, UserSchema) : apiSend("POST", "/held", {})
    ).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(ApiRequestError);
    expect(result).toMatchObject({
      status: 202,
      code: "approval_pending",
      message: "Sent to Admin for approval (approval_123). It runs when Admin approves it.",
    });
    expect(shouldRetry(0, result)).toBe(false);
  });
  it("keeps ordinary 202 responses successful", async () => {
    server.use(http.post(apiPath("/queued"), () => HttpResponse.json(mockUser, { status: 202 })));
    await expect(apiPost("/queued", {}, UserSchema)).resolves.toEqual(mockUser);
    await expect(apiSend("POST", "/queued", {})).resolves.toBeUndefined();
  });
  it("preserves the forbidden code and does not retry it", async () => {
    server.use(
      http.post(apiPath("/denied"), () =>
        HttpResponse.json(
          {
            error: { code: "forbidden", message: "Not allowed" },
          },
          { status: 403 },
        ),
      ),
    );
    const result: unknown = await apiPost("/denied", {}, UserSchema).catch(
      (error: unknown) => error,
    );
    expect(result).toMatchObject({ status: 403, code: "forbidden" });
    expect(shouldRetry(0, result)).toBe(false);
  });
});

describe("approval and agent APIs", () => {
  it("forwards filters and cursors and validates decision responses", async () => {
    const first = await listApprovals({ limit: 1 });
    const next = await listApprovals({ limit: 1, cursor: first.nextCursor! });
    expect(next.items[0]?.id).not.toBe(first.items[0]?.id);
    expect((await listApprovals({ status: "pending" })).items.map((item) => item.status)).toEqual([
      "pending",
    ]);
    expect((await approveRequest("approval_pending")).status).toBe("done");
    expect((await rejectRequest("approval_pending")).status).toBe("rejected");
  });
  it("supports account reads, creation, password and access writes", async () => {
    expect((await getAgentAccount()).enabled).toBe(true);
    expect(
      (
        await createAgentAccount({
          name: "Helper",
          email: "agent@example.com",
          password: "x".repeat(12),
        })
      ).name,
    ).toBe("Helper");
    expect((await updateAgentPassword({ password: "x".repeat(12) })).id).toBe("usr_agent");
    expect((await updateAgentAccess({ enabled: false })).enabled).toBe(false);
  });
});

function queryWrapper() {
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

describe("approval and agent hooks", () => {
  it("treats only 404 as no account", async () => {
    const { client, wrapper } = queryWrapper();
    server.use(http.get(apiPath("/agent"), () => new HttpResponse(null, { status: 404 })));
    const hook = renderHook(() => useAgentAccount(), { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data).toBeNull();
    server.use(
      http.get(apiPath("/agent"), () =>
        HttpResponse.json(
          {
            error: { code: "forbidden", message: "Not allowed" },
          },
          { status: 403 },
        ),
      ),
    );
    await act(() => hook.result.current.refetch());
    await waitFor(() => expect(hook.result.current.error).toMatchObject({ status: 403 }));
    hook.unmount();
    client.clear();
  });
  it("flattens approval pages for the selected status", async () => {
    const { client, wrapper } = queryWrapper();
    const hook = renderHook(() => useApprovals("pending"), { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data?.map((item) => item.status)).toEqual(["pending"]);
    hook.unmount();
    client.clear();
  });
  it("invalidates the matching cache after every mutation", async () => {
    const { client, wrapper } = queryWrapper();
    const invalidated = vi.spyOn(client, "invalidateQueries");
    const hook = renderHook(
      () => ({
        approve: useApproveRequest(),
        reject: useRejectRequest(),
        create: useCreateAgentAccount(),
        password: useUpdateAgentPassword(),
        access: useUpdateAgentAccess(),
      }),
      { wrapper },
    );
    await act(() => hook.result.current.approve.mutateAsync("approval_pending"));
    await act(() => hook.result.current.reject.mutateAsync("approval_pending"));
    expect(invalidated.mock.calls.slice(0, 2)).toEqual([
      [{ queryKey: queryKeys.approvals.all }],
      [{ queryKey: queryKeys.approvals.all }],
    ]);
    await act(() =>
      hook.result.current.create.mutateAsync({
        name: "Agent",
        email: "agent@example.com",
        password: "x".repeat(12),
      }),
    );
    await act(() => hook.result.current.password.mutateAsync({ password: "x".repeat(12) }));
    await act(() => hook.result.current.access.mutateAsync({ enabled: false }));
    expect(invalidated.mock.calls.slice(2)).toEqual(
      Array.from({ length: 3 }, () => [{ queryKey: queryKeys.agent }]),
    );
    hook.unmount();
    client.clear();
  });
});
