import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Skeleton } from "../Skeleton/Skeleton";
import { DataTableCards } from "./DataTableCards";
import { DataTablePagination } from "./DataTablePagination";
import "./columnMeta";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  caption: string;
  getRowId?: (row: TData) => string;
  pageSize?: number;
  initialSort?: SortingState;
  loading?: boolean;
  error?: React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<TData, TValue = unknown>({
  columns,
  data,
  caption,
  getRowId,
  pageSize = 10,
  initialSort,
  loading = false,
  error,
  emptyState,
  className,
}: DataTableProps<TData, TValue>): React.ReactElement {
  const [sorting, setSorting] = React.useState<SortingState>(initialSort ?? []);
  const [pageIndex, setPageIndex] = React.useState(0);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPageIndex(0);
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
    autoResetPageIndex: false,
  });

  React.useEffect(() => {
    setPageIndex(0);
  }, [data, pageSize]);

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border-default bg-bg-surface">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-bg-raised text-label uppercase text-text-muted border-b border-border-default">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const isNumeric = meta?.numeric ?? false;
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();

                  const ariaSort =
                    isSorted === "asc"
                      ? "ascending"
                      : isSorted === "desc"
                        ? "descending"
                        : canSort
                          ? "none"
                          : undefined;

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={ariaSort}
                      className={cn(
                        "px-5 py-3 font-semibold",
                        isNumeric ? "text-right" : "text-left",
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-xs transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action",
                            isNumeric && "flex-row-reverse",
                          )}
                        >
                          <span>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {isSorted === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : isSorted === "desc" ? (
                            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          ) : (
                            <ArrowUpDown
                              className="h-3.5 w-3.5 shrink-0 opacity-50"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ) : (
                        <span>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border-default">
            {loading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((_, colIndex) => (
                    <td key={colIndex} className="px-5 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center">
                  <div role="alert" className="text-body text-loss">
                    {error}
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-8 text-center text-body text-text-muted"
                >
                  {emptyState ?? "No rows to show"}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-bg-raised/50">
                  {row.getVisibleCells().map((cell) => {
                    const isNumeric = cell.column.columnDef.meta?.numeric ?? false;

                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-5 py-3 text-body text-text-primary",
                          isNumeric && "text-right font-mono text-number tabular-nums",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        <DataTableCards
          table={table}
          caption={caption}
          loading={loading}
          error={error}
          emptyState={emptyState}
        />
      </div>

      {/* Pagination */}
      {!loading && !error && <DataTablePagination table={table} />}
    </div>
  );
}
