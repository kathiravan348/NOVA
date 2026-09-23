import * as React from "react";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "../Checkbox/Checkbox";
import "./columnMeta";

export interface SelectionOptions<TData> {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  isRowSelectable?: (row: TData) => boolean;
}

/** Leading checkbox column. Selection is keyed by row id, so it survives sorting, paging and search. */
export function selectionColumn<TData, TValue>({
  selectedIds,
  onSelectedIdsChange,
  isRowSelectable,
}: SelectionOptions<TData>): ColumnDef<TData, TValue> {
  const selected = new Set(selectedIds);
  const canSelect = (row: Row<TData>): boolean => isRowSelectable?.(row.original) ?? true;

  return {
    id: "__select",
    enableSorting: false,
    meta: { selection: true },
    header: ({ table }) => {
      const shownIds = table
        .getFilteredRowModel()
        .rows.filter(canSelect)
        .map((r) => r.id);
      const count = shownIds.filter((id) => selected.has(id)).length;
      const all = shownIds.length > 0 && count === shownIds.length;
      const checked = all ? true : count > 0 ? "indeterminate" : false;
      return (
        <Checkbox
          label={<span className="sr-only">Select all shown</span>}
          checked={checked}
          disabled={shownIds.length === 0}
          onCheckedChange={() => {
            if (all) {
              const shown = new Set(shownIds);
              onSelectedIdsChange(selectedIds.filter((id) => !shown.has(id)));
            } else {
              onSelectedIdsChange([...new Set([...selectedIds, ...shownIds])]);
            }
          }}
        />
      );
    },
    cell: ({ row }) => (
      <Checkbox
        label={<span className="sr-only">{`Select ${row.id}`}</span>}
        checked={selected.has(row.id)}
        disabled={!canSelect(row)}
        onCheckedChange={(value) => {
          onSelectedIdsChange(
            value === true ? [...selectedIds, row.id] : selectedIds.filter((id) => id !== row.id),
          );
        }}
      />
    ),
  };
}
