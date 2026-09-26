import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { UniverseEntry } from "@nova/contracts";
import { Button, DataTable, Select } from "@nova/ui-core";
import { useMarketIndices } from "@nova/services";

export interface BulkStockPickerProps {
  caption: string;
  entries: UniverseEntry[];
  columns: ColumnDef<UniverseEntry, unknown>[];
  selected: string[];
  onChange: (symbols: string[]) => void;
  /** Rows that cannot be picked (e.g. not synced with Kite) are skipped by bulk adds too. */
  isSelectable?: (entry: UniverseEntry) => boolean;
  loading?: boolean;
  error?: ReactNode;
  pageSize?: number;
}

const countLabel = (name: string, count: number) =>
  `${name} (${count} ${count === 1 ? "stock" : "stocks"})`;

/** Stock table with **Add index…**, **Add sector…** and **Clear** for picking in bulk (D57 (6)). */
export function BulkStockPicker({
  caption,
  entries,
  columns,
  selected,
  onChange,
  isSelectable = () => true,
  loading,
  error,
  pageSize = 10,
}: BulkStockPickerProps) {
  const indices = useMarketIndices();
  const pickable = entries.filter(isSelectable);

  const add = (symbols: string[]) => {
    const next = new Set(selected);
    for (const symbol of symbols) next.add(symbol);
    onChange([...next]);
  };

  const indexOptions = (indices.data ?? [])
    .map((index) => ({
      name: index.name,
      count: pickable.filter((e) => e.indices.includes(index.name)).length,
    }))
    .filter((o) => o.count > 0)
    .map((o) => ({ value: o.name, label: countLabel(o.name, o.count) }));

  const sectorCounts = new Map<string, number>();
  for (const entry of pickable) {
    sectorCounts.set(entry.sector, (sectorCounts.get(entry.sector) ?? 0) + 1);
  }
  const sectorOptions = [...sectorCounts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sector, count]) => ({ value: sector, label: countLabel(sector, count) }));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Select
          label="Add index"
          placeholder="Add index…"
          options={indexOptions}
          value=""
          disabled={indexOptions.length === 0}
          onChange={(e) =>
            add(pickable.filter((s) => s.indices.includes(e.target.value)).map((s) => s.symbol))
          }
        />
        <Select
          label="Add sector"
          placeholder="Add sector…"
          options={sectorOptions}
          value=""
          disabled={sectorOptions.length === 0}
          onChange={(e) =>
            add(pickable.filter((s) => s.sector === e.target.value).map((s) => s.symbol))
          }
        />
        <Button
          type="button"
          variant="secondary"
          disabled={selected.length === 0}
          onClick={() => onChange([])}
        >
          Clear
        </Button>
      </div>
      <DataTable
        caption={caption}
        columns={columns}
        data={entries}
        getRowId={(e) => e.symbol}
        loading={loading}
        error={error}
        selectedIds={selected}
        isRowSelectable={isSelectable}
        onSelectedIdsChange={onChange}
        search={{
          label: "Search stocks",
          placeholder: "Symbol or name",
          getText: (e) => `${e.symbol} ${e.name} ${e.sector}`,
        }}
        pageSize={pageSize}
      />
    </div>
  );
}
