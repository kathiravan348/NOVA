import { HttpResponse } from "msw";
import type { ApiError } from "@nova/contracts";

export const API_BASE_PATH = "/api/v1";

export function apiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `*${API_BASE_PATH}${normalized}`;
}

export function notFound(message: string): Response {
  const body: ApiError = {
    error: {
      code: "not_found",
      message,
    },
  };
  return HttpResponse.json<ApiError>(body, { status: 404 });
}

export function internalError(message = "Internal server error"): Response {
  const body: ApiError = {
    error: {
      code: "internal",
      message,
    },
  };
  return HttpResponse.json<ApiError>(body, { status: 500 });
}

export function badRequest(message: string): Response {
  const body: ApiError = {
    error: {
      code: "invalid_request",
      message,
    },
  };
  return HttpResponse.json<ApiError>(body, { status: 400 });
}
