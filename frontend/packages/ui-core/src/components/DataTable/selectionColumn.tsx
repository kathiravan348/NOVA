import * as React from "react";
import type { CellContext, ColumnDef, HeaderContext } from "@tanstack/react-table";
import { Checkbox } from "../Checkbox/Checkbox";
import "./columnMeta";

interface SelectionState {
  selected: Set<string>;
  isSelectable: (row: unknown) => boolean;
  onChange: (ids: string[]) => void;
  /** Latest selection at click time. */
  current: () => string[];
}

/**
 * The column below is created once per table. Its cells read the selection from this context,
 * so a selection change re-renders them instead of remounting them (keeps keyboard focus).
 */
export const SelectionContext = React.createContext<SelectionState | null>(null);

function useSelection(): SelectionState {
  const state = React.useContext(SelectionContext);
  if (!state) throw new Error("Selection cells need a SelectionContext provider");
  return state;
}

function SelectAllCell<TData, TValue>({ table }: HeaderContext<TData, TValue>) {
  const s = useSelection();
  const shownIds = table
    .getFilteredRowModel()
    .rows.filter((r) => s.isSelectable(r.original))
    .map((r) => r.id);
  const count = shownIds.filter((id) => s.selected.has(id)).length;
  const all = shownIds.length > 0 && count === shownIds.length;
  return (
    <Checkbox
      label={<span className="sr-only">Select all shown</span>}
      checked={all ? true : count > 0 ? "indeterminate" : false}
      disabled={shownIds.length === 0}
      onCheckedChange={() => {
        const current = s.current();
        if (all) {
          const shown = new Set(shownIds);
          s.onChange(current.filter((id) => !shown.has(id)));
        } else {
          s.onChange([...new Set([...current, ...shownIds])]);
        }
      }}
    />
  );
}

function SelectRowCell<TData, TValue>({ row }: CellContext<TData, TValue>) {
  const s = useSelection();
  return (
    <Checkbox
      label={<span className="sr-only">{`Select ${row.id}`}</span>}
      checked={s.selected.has(row.id)}
      disabled={!s.isSelectable(row.original)}
      onCheckedChange={(value) => {
        const current = s.current().filter((id) => id !== row.id);
        s.onChange(value === true ? [...current, row.id] : current);
      }}
    />
  );
}

/** Leading checkbox column. Selection is keyed by row id, so it survives sorting, paging and search. */
export function selectionColumn<TData, TValue>(): ColumnDef<TData, TValue> {
  return {
    id: "__select",
    enableSorting: false,
    meta: { selection: true },
    header: SelectAllCell,
    cell: SelectRowCell,
  };
}
