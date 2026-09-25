import { ApiErrorSchema, type ApiErrorCode } from "@nova/contracts";
import type { z } from "zod";
import { getApiBaseUrl } from "./config";

export const API_PREFIX = "/api/v1";

export type ApiRequestErrorCode = ApiErrorCode | "invalid_response" | "network" | "unauthorized";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiRequestErrorCode;

  constructor(status: number, code: ApiRequestErrorCode, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
}

let unauthorizedHandler: (() => void) | undefined;

/** Called on every 401 (session expired or signed out elsewhere); the session module registers it. */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

/** Appends defined query values to a path: `withQuery("/audit", { limit: 10 })` → `/audit?limit=10`. */
export function withQuery(
  path: string,
  query: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestOptions,
): Promise<T> {
  const url = new URL(API_PREFIX + path, getApiBaseUrl());

  let res: Response;
  try {
    res = await fetch(url, { signal: init?.signal, headers: { Accept: "application/json" } });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiRequestError(0, "network", `Network error for GET ${path}`);
  }

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) throw toApiError(res.status, body, `GET ${path}`);

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiRequestError(res.status, "invalid_response", `Invalid response for GET ${path}`);
  }
  return parsed.data;
}

function toApiError(status: number, body: unknown, what: string): ApiRequestError {
  if (status === 401) unauthorizedHandler?.();
  const parsed = ApiErrorSchema.safeParse(body);
  if (parsed.success) {
    return new ApiRequestError(status, parsed.data.error.code, parsed.data.error.message);
  }
  return new ApiRequestError(status, "internal", `${what} failed with ${status}`);
}

/** Sends a JSON body and expects an empty success response (e.g. 204). */
export async function apiSend(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  init?: RequestOptions,
): Promise<void> {
  const url = new URL(API_PREFIX + path, getApiBaseUrl());

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal: init?.signal,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiRequestError(0, "network", `Network error for ${method} ${path}`);
  }

  if (!res.ok) {
    const errorBody: unknown = await res.json().catch(() => undefined);
    throw toApiError(res.status, errorBody, `${method} ${path}`);
  }
}

/** Sends a JSON body and validates the JSON answer with `schema` (e.g. sign-in). */
export function apiPost<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  init?: RequestOptions,
): Promise<T> {
  return apiRequest("POST", path, body, schema, init);
}

export async function apiRequest<T>(
  method: "POST" | "PATCH" | "PUT",
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  init?: RequestOptions,
): Promise<T> {
  const url = new URL(API_PREFIX + path, getApiBaseUrl());

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      signal: init?.signal,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiRequestError(0, "network", `Network error for ${method} ${path}`);
  }

  const answer: unknown = await res.json().catch(() => undefined);
  if (!res.ok) throw toApiError(res.status, answer, `${method} ${path}`);
  const parsed = schema.safeParse(answer);
  if (!parsed.success) {
    throw new ApiRequestError(
      res.status,
      "invalid_response",
      `Invalid response for ${method} ${path}`,
    );
  }
  return parsed.data;
}
