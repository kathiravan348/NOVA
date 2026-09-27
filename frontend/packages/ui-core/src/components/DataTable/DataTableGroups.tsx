import * as React from "react";
import { flexRender, type Row, type Table } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { DataTableCards } from "./DataTableCards";
import "./columnMeta";

/** Shows rows in collapsible groups; a row may sit in several groups (e.g. tags). */
export interface DataTableGroups<TData> {
  /** Group keys of a row; an empty list hides the row. */
  of: (row: TData) => string[];
  /** Header text of a group; default: the key. */
  label?: (key: string) => React.ReactNode;
  /** Shown next to the label; gets the group's rows that pass the search. */
  summary?: (key: string, rows: TData[]) => React.ReactNode;
  /** Buttons at the end of the header; gets the group's rows that pass the search. */
  actions?: (key: string, rows: TData[]) => React.ReactNode;
  /** Group order; default: alphabetical by key. */
  order?: (a: string, b: string) => number;
  /** Groups start open when true; default false. */
  defaultOpen?: boolean;
}

export interface RowGroup<TData> {
  key: string;
  rows: Row<TData>[];
}

/** Rows (already filtered and sorted) into groups; order inside a group follows the rows. */
export function groupRows<TData>(
  rows: Row<TData>[],
  groups: DataTableGroups<TData>,
): RowGroup<TData>[] {
  const byKey = new Map<string, Row<TData>[]>();
  for (const row of rows) {
    for (const key of new Set(groups.of(row.original))) {
      const members = byKey.get(key) ?? [];
      members.push(row);
      byKey.set(key, members);
    }
  }
  const order = groups.order ?? ((a: string, b: string) => a.localeCompare(b));
  return [...byKey]
    .map(([key, members]) => ({ key, rows: members }))
    .sort((a, b) => order(a.key, b.key));
}

/** Which groups are open: `defaultOpen` unless the user toggled that group. */
export function useOpenGroups(defaultOpen = false) {
  const [toggled, setToggled] = React.useState<ReadonlySet<string>>(new Set());
  const isOpen = (key: string) => defaultOpen !== toggled.has(key);
  const toggle = (key: string) =>
    setToggled((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return { isOpen, toggle };
}

interface GroupHeaderProps<TData> {
  group: RowGroup<TData>;
  groups: DataTableGroups<TData>;
  open: boolean;
  onToggle: () => void;
}

function GroupHeader<TData>({ group, groups, open, onToggle }: GroupHeaderProps<TData>) {
  const originals = group.rows.map((row) => row.original);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 rounded-xs text-body font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
      >
        <Chevron className="h-4 w-4 shrink-0" aria-hidden="true" />
        {groups.label?.(group.key) ?? group.key}
      </button>
      {groups.summary && (
        <span className="text-body-sm text-text-muted">{groups.summary(group.key, originals)}</span>
      )}
      {groups.actions && (
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {groups.actions(group.key, originals)}
        </div>
      )}
    </div>
  );
}

/** One body row of the desktop table (shared by plain and grouped tables). */
export function DataRow<TData>({ row }: { row: Row<TData> }) {
  return (
    <tr className="transition-colors hover:bg-bg-raised/50">
      {row.getVisibleCells().map((cell) => {
        const isNumeric = cell.column.columnDef.meta?.numeric ?? false;
        return (
          <td
            key={cell.id}
            className={cn(
              "px-5 py-3 text-body text-text-primary",
              isNumeric && "whitespace-nowrap text-right font-mono text-number tabular-nums",
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );
}

interface GroupedProps<TData> {
  grouped: RowGroup<TData>[];
  groups: DataTableGroups<TData>;
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
}

/** Desktop: one `<tbody>` per group, its header row first. */
export function DataTableGroupBodies<TData>({
  grouped,
  groups,
  isOpen,
  onToggle,
  columnCount,
}: GroupedProps<TData> & { columnCount: number }) {
  return (
    <>
      {grouped.map((group) => (
        <tbody
          key={group.key}
          className="divide-y divide-border-default border-t border-border-default"
        >
          <tr className="bg-bg-raised">
            <th
              scope="rowgroup"
              colSpan={columnCount}
              className="px-5 py-3 text-left font-normal normal-case"
            >
              <GroupHeader
                group={group}
                groups={groups}
                open={isOpen(group.key)}
                onToggle={() => onToggle(group.key)}
              />
            </th>
          </tr>
          {isOpen(group.key) && group.rows.map((row) => <DataRow key={row.id} row={row} />)}
        </tbody>
      ))}
    </>
  );
}

/** Mobile: a header card per group, then that group's rows as cards. */
export function DataTableGroupCards<TData>({
  table,
  caption,
  grouped,
  groups,
  isOpen,
  onToggle,
}: GroupedProps<TData> & { table: Table<TData>; caption: string }) {
  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <section key={group.key} className="space-y-3">
          <div className="rounded-lg border border-border-default bg-bg-raised p-3">
            <GroupHeader
              group={group}
              groups={groups}
              open={isOpen(group.key)}
              onToggle={() => onToggle(group.key)}
            />
          </div>
          {isOpen(group.key) && (
            <DataTableCards table={table} caption={`${caption}: ${group.key}`} rows={group.rows} />
          )}
        </section>
      ))}
    </div>
  );
}
