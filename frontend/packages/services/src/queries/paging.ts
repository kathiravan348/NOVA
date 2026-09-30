import { getBacktest } from "../api/orbit";
import { queryKeys } from "./keys";
import type { Page } from "@nova/contracts";
import { keepPreviousData, useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export interface PageSelection {
  page: number;
  pageSize: number;
}

export function usePageState(resetKey = "") {
  const [page, setPage] = useState(1);
  const [pageSize, setSize] = useState(50);
  useEffect(() => setPage(1), [resetKey]);
  const setPageSize = (size: number) => {
    setSize(size);
    setPage(1);
  };
  return { page, pageSize, setPage, setPageSize };
}

export function pageQuery(selection?: PageSelection): { offset?: number; limit?: number } {
  return selection
    ? { offset: (selection.page - 1) * selection.pageSize, limit: selection.pageSize }
    : {};
}

export const keepPageOptions = { placeholderData: keepPreviousData };

export function pageResult<T>(data: { pages: Page<T>[] }) {
  return { items: flattenPages(data), total: data.pages[0]?.total ?? 0 };
}

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

/** Requested compare runs stay available when the picker changes pages. */
export function useBacktestRuns(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.backtests.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getBacktest(id, { signal }),
    })),
  });
}

export function useJobPageRefresh(selection?: PageSelection) {
  const client = useQueryClient();
  const page = selection?.page;
  const pageSize = selection?.pageSize;
  useEffect(() => {
    if (page === undefined) return;
    // Job messages update detail caches. Refetch the visible offset page so inserts,
    // removals and changed totals retain the server's ordering and page boundaries.
    return client.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (
        key[0] === "data-jobs" &&
        key.length === 2 &&
        key[1] !== "list" &&
        key[1] !== "latest-sync" &&
        ((event.type === "updated" && event.action.type === "success") || event.type === "removed")
      ) {
        void client.invalidateQueries({
          queryKey: [...queryKeys.dataJobs.list, { page, pageSize }],
        });
      }
    });
  }, [client, page, pageSize]);
}
