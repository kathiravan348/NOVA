import { ApiErrorSchema, type ApiErrorCode } from "@nova/contracts";
import type { z } from "zod";
import { getApiBaseUrl } from "./config";

export const API_PREFIX = "/api/v1";

export type ApiRequestErrorCode = ApiErrorCode | "invalid_response" | "network";

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

  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success) {
      throw new ApiRequestError(res.status, parsed.data.error.code, parsed.data.error.message);
    }
    throw new ApiRequestError(res.status, "internal", `GET ${path} failed with ${res.status}`);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiRequestError(res.status, "invalid_response", `Invalid response for GET ${path}`);
  }
  return parsed.data;
}
