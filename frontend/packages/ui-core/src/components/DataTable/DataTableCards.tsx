import * as React from "react";
import { flexRender, type Table } from "@tanstack/react-table";
import { cn } from "../../lib/cn";
import { Skeleton } from "../Skeleton/Skeleton";
import "./columnMeta";

export interface DataTableCardsProps<TData> {
  table: Table<TData>;
  caption: string;
  loading?: boolean;
  error?: React.ReactNode;
  emptyState?: React.ReactNode;
}

export function DataTableCards<TData>({
  table,
  caption,
  loading = false,
  error,
  emptyState,
}: DataTableCardsProps<TData>): React.ReactElement {
  if (loading) {
    return (
      <ul aria-label={caption} className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="rounded-lg border border-border-default bg-bg-surface p-4 space-y-3"
          >
            <Skeleton className="h-5 w-1/3" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <div role="alert" className="p-6 text-center text-body text-loss">
        {error}
      </div>
    );
  }

  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-body text-text-muted">
        {emptyState ?? "No rows to show"}
      </div>
    );
  }

  return (
    <ul aria-label={caption} className="space-y-3">
      {rows.map((row) => {
        const allCells = row.getVisibleCells();
        const selectCell = allCells.find((cell) => cell.column.columnDef.meta?.selection);
        const cells = allCells.filter((cell) => cell !== selectCell);
        const primaryCell =
          cells.find((cell) => cell.column.columnDef.meta?.primary) ??
          cells.find((cell) => !cell.column.columnDef.meta?.hideOnMobile);

        const visibleCells = cells.filter((cell) => {
          if (cell === primaryCell) return false;
          return !cell.column.columnDef.meta?.hideOnMobile;
        });

        return (
          <li key={row.id} className="rounded-lg border border-border-default bg-bg-surface p-4">
            {(selectCell || primaryCell) && (
              <div className="flex items-start gap-3">
                {selectCell &&
                  flexRender(selectCell.column.columnDef.cell, selectCell.getContext())}
                {primaryCell && (
                  <div className="font-sans text-body font-semibold text-text-primary">
                    {flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext())}
                  </div>
                )}
              </div>
            )}
            {visibleCells.length > 0 && (
              <dl className="mt-3 space-y-2 text-body-sm">
                {visibleCells.map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  const header = cell.column.columnDef.header;
                  const label =
                    meta?.mobileLabel ?? (typeof header === "string" ? header : cell.column.id);

                  return (
                    <div key={cell.id} className="flex items-center justify-between gap-2">
                      <dt className="text-text-muted">{label}</dt>
                      <dd
                        className={cn(
                          "text-text-primary",
                          meta?.numeric && "whitespace-nowrap font-mono text-number text-right",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
