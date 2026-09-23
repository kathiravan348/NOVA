import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { UserSchema } from "@nova/contracts";
import { apiPath, handlers, mockUser } from "@nova/mocks";
import { getApiBaseUrl, getDataMode } from "./config";
import { apiGet, ApiRequestError } from "./http";

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

  it("refuses real mode in Stage A", () => {
    vi.stubEnv("VITE_DATA_MODE", "real");
    expect(getDataMode()).toBe("real");
    expect(() => getApiBaseUrl()).toThrow("DATA_MODE=real is not available in Stage A");
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

  it("throws before fetching in real mode", async () => {
    vi.stubEnv("VITE_DATA_MODE", "real");
    await expect(apiGet("/me", UserSchema)).rejects.toThrow("not available in Stage A");
  });
});
