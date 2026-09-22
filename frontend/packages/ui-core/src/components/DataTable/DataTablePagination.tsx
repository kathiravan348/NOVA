import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "../IconButton/IconButton";

export interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>): React.ReactElement | null {
  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;

  if (totalRows <= pageSize) {
    return null;
  }

  const startRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="flex items-center justify-between gap-4 py-4 px-2">
      <span className="text-body-sm text-text-muted">
        Showing {startRow}–{endRow} of {totalRows}
      </span>
      <div className="flex items-center gap-2">
        <IconButton
          icon={<ChevronLeft className="h-4 w-4" />}
          aria-label="Previous page"
          variant="secondary"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        />
        <IconButton
          icon={<ChevronRight className="h-4 w-4" />}
          aria-label="Next page"
          variant="secondary"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        />
      </div>
    </div>
  );
}
