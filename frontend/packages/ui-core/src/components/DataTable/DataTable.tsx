import * as React from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { cn } from "../../lib/cn";
import { Skeleton } from "../Skeleton/Skeleton";
import { DataTableCards } from "./DataTableCards";
import { DataTableHead } from "./DataTableHead";
import {
  DataRow,
  DataTableGroupBodies,
  DataTableGroupCards,
  groupRows,
  useOpenGroups,
  type DataTableGroups,
} from "./DataTableGroups";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableToolbar, type DataTableSearch } from "./DataTableToolbar";
import { SelectionContext, selectionColumn } from "./selectionColumn";
import "./columnMeta";

interface DataTableBaseProps<TData, TValue> {
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
  search?: DataTableSearch<TData>;
  /** Extra controls (e.g. filter selects) shown next to the search box. */
  toolbar?: React.ReactNode;
}

interface DataTableSelectionProps<TData> {
  /** Optional inline details after a desktop row and inside its mobile card. Return null when closed. */
  renderRowDetails?: (row: TData) => React.ReactNode;
  /** Selection is on when both are set; needs `getRowId`. */
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  isRowSelectable?: (row: TData) => boolean;
  groups?: never;
}

interface DataTableGroupedProps<TData> {
  renderRowDetails?: never;
  /**
   * Rows in collapsible groups, not paginated. Not combined with selection: a row in two groups
   * would show two checkboxes for one choice.
   */
  groups?: DataTableGroups<TData>;
  selectedIds?: never;
  onSelectedIdsChange?: never;
  isRowSelectable?: never;
}

export type DataTableProps<TData, TValue> = DataTableBaseProps<TData, TValue> &
  (DataTableSelectionProps<TData> | DataTableGroupedProps<TData>);

export function DataTable<TData, TValue = unknown>({
  columns,
  data,
  caption,
  getRowId,
  pageSize,
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
  groups,
  renderRowDetails,
}: DataTableProps<TData, TValue>): React.ReactElement {
  const open = useOpenGroups(groups?.defaultOpen);
  const [sorting, setSorting] = React.useState<SortingState>(initialSort ?? []);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: pageSize ?? 10 });
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
      pagination,
    },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    onGlobalFilterChange: (value: string) => {
      setQuery(value);
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    },
    getColumnCanGlobalFilter: () => true,
    globalFilterFn: (row, _columnId, value: string) =>
      search === undefined ||
      search.getText(row.original).toLowerCase().includes(value.trim().toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: pageSize === undefined,
    getRowId,
    autoResetPageIndex: false,
  });

  React.useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [data, pageSize]);
  React.useEffect(() => {
    setPagination((current) => ({ ...current, pageSize: pageSize ?? 10 }));
  }, [pageSize]);

  const noMatch =
    query.trim() !== "" && data.length > 0 ? `No rows match "${query.trim()}"` : undefined;
  const emptyContent = noMatch ?? emptyState;
  // Groups see every filtered, sorted row: no pagination while grouped.
  const grouped = groups ? groupRows(table.getPrePaginationRowModel().rows, groups) : null;
  const view =
    groups && grouped && grouped.length > 0 && !loading && !error ? { groups, grouped } : null;
  const noRows = grouped ? grouped.length === 0 : table.getRowModel().rows.length === 0;

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
            <DataTableHead table={table} />
            {view ? (
              <DataTableGroupBodies
                grouped={view.grouped}
                groups={view.groups}
                isOpen={open.isOpen}
                onToggle={open.toggle}
                columnCount={allColumns.length}
              />
            ) : (
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
                ) : noRows ? (
                  <tr>
                    <td
                      colSpan={allColumns.length}
                      className="px-5 py-8 text-center text-body text-text-muted"
                    >
                      {emptyContent ?? "No rows to show"}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const detail = renderRowDetails?.(row.original);
                    return (
                      <React.Fragment key={row.id}>
                        <DataRow row={row} />
                        {detail != null && (
                          <tr>
                            <td colSpan={allColumns.length} className="px-5 py-4">
                              {detail}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            )}
          </table>
        </div>

        {/* Mobile view */}
        <div className="md:hidden">
          {view ? (
            <DataTableGroupCards
              table={table}
              caption={caption}
              grouped={view.grouped}
              groups={view.groups}
              isOpen={open.isOpen}
              onToggle={open.toggle}
            />
          ) : (
            <DataTableCards
              table={table}
              caption={caption}
              loading={loading}
              error={error}
              emptyState={emptyContent}
              rows={grouped ? [] : undefined}
              renderRowDetails={renderRowDetails}
            />
          )}
        </div>

        {/* Pagination: not while grouped (every group shows all its rows) */}
        {!loading && !error && !groups && pageSize !== undefined && (
          <DataTablePagination table={table} pageSizes={[pageSize, 25, 50, 100, 200]} />
        )}
      </div>
    </SelectionContext.Provider>
  );
}
