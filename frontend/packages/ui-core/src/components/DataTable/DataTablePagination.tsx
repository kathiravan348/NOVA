import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { Pager } from "../Pager/Pager";

export interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  pageSizes?: number[];
}

export function DataTablePagination<TData>({
  table,
  pageSizes,
}: DataTablePaginationProps<TData>): React.ReactElement | null {
  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;

  if (totalRows === 0) {
    return null;
  }

  return (
    <Pager
      page={pageIndex + 1}
      pageSize={pageSize}
      total={totalRows}
      pageSizes={pageSizes}
      onPageChange={(page) => table.setPageIndex(page - 1)}
      onPageSizeChange={(size) => table.setPageSize(size)}
    />
  );
}
