import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { apiPath, handlers, mockUser } from "@nova/mocks";
import { apiGet } from "./http";
import { UserSchema } from "@nova/contracts";
import { getSession, signIn, signOut, useSession } from "./session";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
let requests: string[] = [];
server.events.on("request:start", ({ request }) => {
  requests.push(`${request.method} ${new URL(request.url).pathname}`);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await signOut();
  server.resetHandlers();
  requests = [];
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
    await signOut();
    expect(getSession()).toBeNull();
    expect(requests).not.toContain("POST /api/v1/auth/logout"); // mock mode never calls it
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
    await act(() => signOut());
    expect(result.current).toBeNull();
  });

  it("signs in and out through NOVA Core in real mode (D48)", async () => {
    vi.stubEnv("VITE_DATA_MODE", "real");

    const session = await signIn("owner@example.com", "a long password");
    await signOut();

    expect(session).toEqual({ userId: mockUser.id, displayName: mockUser.name });
    expect(requests).toEqual(["POST /api/v1/auth/login", "POST /api/v1/auth/logout"]);
    expect(getSession()).toBeNull();
  });

  it("needs an email address in real mode", async () => {
    vi.stubEnv("VITE_DATA_MODE", "real");
    await expect(signIn("asha", "pw")).rejects.toMatchObject({ code: "invalid_request" });
    expect(requests).toEqual([]);
  });

  it("shows NOVA Core's refusal for wrong details", async () => {
    vi.stubEnv("VITE_DATA_MODE", "real");
    server.use(
      http.post(apiPath("/auth/login"), () =>
        HttpResponse.json(
          { error: { code: "unauthorized", message: "Wrong email or password" } },
          { status: 401 },
        ),
      ),
    );
    await expect(signIn("owner@example.com", "nope")).rejects.toThrow("Wrong email or password");
    expect(getSession()).toBeNull();
  });

  it("any 401 ends the session (expired cookie)", async () => {
    await signIn("asha", "pw");
    server.use(
      http.get(apiPath("/me"), () =>
        HttpResponse.json(
          { error: { code: "unauthorized", message: "Sign in required" } },
          { status: 401 },
        ),
      ),
    );
    await expect(apiGet("/me", UserSchema)).rejects.toMatchObject({ status: 401 });
    expect(getSession()).toBeNull();
  });
});
