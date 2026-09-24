import type { Page } from "@nova/contracts";

/** Shared options for cursor-paged lists (D32). */
export const pagedListOptions = {
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last: Page<unknown>) => last.nextCursor ?? undefined,
};

/** `select` for paged lists: screens get one flat array of every loaded page. */
export function flattenPages<T>(data: { pages: Page<T>[] }): T[] {
  return data.pages.flatMap((page) => page.items);
}

/** Query value for the next page: nothing on the first page. */
export function cursorQuery(pageParam: string | undefined): { cursor?: string } {
  return pageParam ? { cursor: pageParam } : {};
}
