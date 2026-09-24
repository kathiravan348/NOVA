import { HttpResponse } from "msw";
import {
  PAGE_LIMIT_DEFAULT,
  PAGE_LIMIT_MAX,
  PageLimitSchema,
  type ApiError,
  type Page,
} from "@nova/contracts";

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

const CURSOR_PREFIX = "offset:";

function encodeCursor(offset: number): string {
  return btoa(`${CURSOR_PREFIX}${offset}`).replace(/=+$/, "");
}

function decodeCursor(cursor: string): number | null {
  let text: string;
  try {
    text = atob(cursor);
  } catch {
    return null;
  }
  const rest = text.startsWith(CURSOR_PREFIX) ? text.slice(CURSOR_PREFIX.length) : "";
  return /^\d+$/.test(rest) ? Number(rest) : null;
}

/** Serves one page of `items` from `?limit=` and `?cursor=` (D32); bad values answer 400. */
export function paginate<T>(items: readonly T[], requestUrl: string): Response {
  const params = new URL(requestUrl).searchParams;

  let limit = PAGE_LIMIT_DEFAULT;
  const rawLimit = params.get("limit");
  if (rawLimit !== null) {
    const parsed = PageLimitSchema.safeParse(/^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN);
    if (!parsed.success) {
      return badRequest(`limit must be a whole number from 1 to ${PAGE_LIMIT_MAX}`);
    }
    limit = parsed.data;
  }

  let offset = 0;
  const cursor = params.get("cursor");
  if (cursor !== null) {
    const decoded = decodeCursor(cursor);
    if (decoded === null || decoded < 1 || decoded >= items.length) {
      return badRequest("Unknown cursor");
    }
    offset = decoded;
  }

  const end = offset + limit;
  const body: Page<T> = {
    items: items.slice(offset, end),
    nextCursor: end < items.length ? encodeCursor(end) : null,
  };
  return HttpResponse.json(body);
}

/** The empty-scenario body for paginated lists. */
export function emptyPage(): Response {
  const body: Page<never> = { items: [], nextCursor: null };
  return HttpResponse.json(body);
}
