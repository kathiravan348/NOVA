import { flexRender, type Table } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "../../lib/cn";
import "./columnMeta";

/** Column headers; sortable columns get a button and `aria-sort`. */
export function DataTableHead<TData>({ table }: { table: Table<TData> }) {
  return (
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
                className={cn("px-5 py-3 font-semibold", isNumeric ? "text-right" : "text-left")}
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
                    <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                    {isSorted === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : isSorted === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                )}
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}
