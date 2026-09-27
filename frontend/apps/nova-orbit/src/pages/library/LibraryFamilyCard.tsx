import type { ColumnDef } from "@tanstack/react-table";
import type { LibraryEntry, LibraryFamily } from "@nova/contracts";
import { Badge, Button, Card, DataTable } from "@nova/ui-core";
import { timeframeLabel } from "../../lib/format";
import { modeLabel } from "../../lib/strategyText";

export interface LibraryFamilyCardProps {
  family: LibraryFamily;
  entries: LibraryEntry[];
  /** Entry ids already added as strategies (matched by name). */
  added: ReadonlySet<string>;
  /** An install is running: row buttons wait. */
  busy: boolean;
  onAdd: (entry: LibraryEntry) => void;
  onBacktest: (entry: LibraryEntry) => void;
}

/** One family of the library: its idea, what to watch, and its strategies (D62 (7)). */
export function LibraryFamilyCard({
  family,
  entries,
  added,
  busy,
  onAdd,
  onBacktest,
}: LibraryFamilyCardProps) {
  const columns: ColumnDef<LibraryEntry, unknown>[] = [
    {
      id: "id",
      header: "ID",
      accessorKey: "id",
      cell: ({ row }) => <span className="font-mono">{row.original.id}</span>,
    },
    {
      id: "name",
      header: "Strategy",
      accessorKey: "name",
      meta: { primary: true },
      cell: ({ row }) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-medium text-text-primary">{row.original.name}</span>
          {added.has(row.original.id) && <Badge tone="success">Added</Badge>}
        </span>
      ),
    },
    {
      id: "summary",
      header: "What it does",
      accessorKey: "summary",
      enableSorting: false,
      cell: ({ row }) => <span className="text-text-secondary">{row.original.summary}</span>,
    },
    {
      id: "mode",
      header: "Mode",
      accessorFn: (e) => `${modeLabel(e.spec.mode)} · ${timeframeLabel[e.spec.timeframe]}`,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const entry = row.original;
        const done = added.has(entry.id);
        return (
          <span className="inline-flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={done || busy}
              aria-label={`Add ${entry.name}`}
              onClick={() => onAdd(entry)}
            >
              {done ? "Added" : "Add"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              aria-label={`Backtest ${entry.name}`}
              onClick={() => onBacktest(entry)}
            >
              Backtest
            </Button>
          </span>
        );
      },
    },
  ];

  return (
    <Card title={family.name}>
      <div className="flex flex-col gap-4">
        <dl className="grid gap-2 text-body-sm sm:grid-cols-2">
          <div>
            <dt className="text-label text-text-muted">Idea</dt>
            <dd className="text-text-primary">{family.idea}</dd>
          </div>
          <div>
            <dt className="text-label text-text-muted">Watch out</dt>
            <dd className="text-text-primary">{family.watch}</dd>
          </div>
        </dl>
        <DataTable
          caption={family.name}
          columns={columns}
          data={entries}
          getRowId={(e) => e.id}
          pageSize={Math.max(entries.length, 1)}
          initialSort={[{ id: "id", desc: false }]}
        />
      </div>
    </Card>
  );
}
