import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers, mockUser } from "@nova/mocks";
import { getSession, signIn, signOut, useSession } from "./session";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  signOut();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

describe("session", () => {
  it("rejects an empty username or password", async () => {
    await expect(signIn("asha", "  ")).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
    await expect(signIn("", "pw")).rejects.toMatchObject({ code: "unauthorized" });
    expect(getSession()).toBeNull();
  });

  it("stores the mock user on sign-in and clears it on sign-out", async () => {
    const session = await signIn("asha", "pw");
    expect(session).toEqual({ userId: mockUser.id, displayName: mockUser.name });
    expect(getSession()).toEqual(session);
    expect(JSON.parse(sessionStorage.getItem("nova-session") ?? "null")).toEqual(session);
    signOut();
    expect(getSession()).toBeNull();
  });

  it("ignores a corrupt stored value", () => {
    sessionStorage.setItem("nova-session", "{not json");
    expect(getSession()).toBeNull();
  });

  it("useSession re-renders on sign-in and sign-out", async () => {
    const { result } = renderHook(() => useSession());
    expect(result.current).toBeNull();
    await act(() => signIn("asha", "pw"));
    expect(result.current?.displayName).toBe(mockUser.name);
    act(() => signOut());
    expect(result.current).toBeNull();
  });

  it("refuses real mode", async () => {
    vi.stubEnv("VITE_DATA_MODE", "real");
    await expect(signIn("asha", "pw")).rejects.toThrow("not available in Stage A");
  });
});
