import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
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
import { DataTableToolbar, type DataTableSearch } from "./DataTableToolbar";
import { SelectionContext, selectionColumn } from "./selectionColumn";
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
  /** Selection is on when both are set; needs `getRowId`. */
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  isRowSelectable?: (row: TData) => boolean;
  search?: DataTableSearch<TData>;
  /** Extra controls (e.g. filter selects) shown next to the search box. */
  toolbar?: React.ReactNode;
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
  selectedIds,
  onSelectedIdsChange,
  isRowSelectable,
  search,
  toolbar,
}: DataTableProps<TData, TValue>): React.ReactElement {
  const [sorting, setSorting] = React.useState<SortingState>(initialSort ?? []);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const selecting = selectedIds !== undefined && onSelectedIdsChange !== undefined;

  const selectedRef = React.useRef(selectedIds ?? []);
  selectedRef.current = selectedIds ?? [];
  const selectColumn = React.useMemo(() => selectionColumn<TData, TValue>(), []);
  const allColumns = React.useMemo(
    () => (selecting ? [selectColumn, ...columns] : columns),
    [selecting, selectColumn, columns],
  );
  const selection = React.useMemo(
    () =>
      selecting
        ? {
            selected: new Set(selectedIds),
            isSelectable: (row: unknown) => isRowSelectable?.(row as TData) ?? true,
            onChange: onSelectedIdsChange,
            current: () => selectedRef.current,
          }
        : null,
    [selecting, selectedIds, isRowSelectable, onSelectedIdsChange],
  );

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      globalFilter: query,
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
    onGlobalFilterChange: (value: string) => {
      setQuery(value);
      setPageIndex(0);
    },
    getColumnCanGlobalFilter: () => true,
    globalFilterFn: (row, _columnId, value: string) =>
      search === undefined ||
      search.getText(row.original).toLowerCase().includes(value.trim().toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
    autoResetPageIndex: false,
  });

  React.useEffect(() => {
    setPageIndex(0);
  }, [data, pageSize]);

  const noMatch =
    query.trim() !== "" && data.length > 0 ? `No rows match "${query.trim()}"` : undefined;
  const emptyContent = noMatch ?? emptyState;

  return (
    <SelectionContext.Provider value={selection}>
      <div className={cn("w-full space-y-4", className)}>
        {(search || toolbar || selecting) && (
          <DataTableToolbar
            searchLabel={search?.label}
            searchPlaceholder={search?.placeholder}
            query={query}
            onQueryChange={(value) => table.setGlobalFilter(value)}
            selectedCount={selecting ? selectedIds.length : undefined}
          >
            {toolbar}
          </DataTableToolbar>
        )}
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
                    {allColumns.map((_, colIndex) => (
                      <td key={colIndex} className="px-5 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={allColumns.length} className="px-5 py-8 text-center">
                    <div role="alert" className="text-body text-loss">
                      {error}
                    </div>
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={allColumns.length}
                    className="px-5 py-8 text-center text-body text-text-muted"
                  >
                    {emptyContent ?? "No rows to show"}
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
                            isNumeric &&
                              "whitespace-nowrap text-right font-mono text-number tabular-nums",
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
            emptyState={emptyContent}
          />
        </div>

        {/* Pagination */}
        {!loading && !error && <DataTablePagination table={table} />}
      </div>
    </SelectionContext.Provider>
  );
}
