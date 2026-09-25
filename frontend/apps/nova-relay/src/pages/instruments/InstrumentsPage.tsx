import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ListOrdered } from "lucide-react";
import type { InstrumentSyncResult, UniverseEntry } from "@nova/contracts";
import { Badge, Button, DataTable, EmptyState, useToast } from "@nova/ui-core";
import { getDataMode, useSyncInstruments, useUniverse } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { RemoveStockModal } from "./RemoveStockModal";
import { UniverseEntryModal } from "./UniverseEntryModal";

type Editing = { entry: UniverseEntry | null } | null;

/** The stock list (D54): add, edit, remove, and sync it with Kite before downloading prices. */
export function InstrumentsPage() {
  const toast = useToast();
  const query = useUniverse();
  const sync = useSyncInstruments();
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<InstrumentSyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const runSync = async () => {
    setSyncError(null);
    try {
      const result = await sync.mutateAsync();
      setLastSync(result);
      const demo = getDataMode() === "mock";
      toast.show({
        title: `Synced ${result.synced.length} ${result.synced.length === 1 ? "stock" : "stocks"}${demo ? " (demo)" : ""}`,
        description: result.missing.length
          ? `${result.missing.length} not found on NSE.`
          : "Every stock is known to Kite.",
        tone: "success",
      });
    } catch (err) {
      setLastSync(null);
      setSyncError(err instanceof Error ? err.message : "Could not sync with Kite");
    }
  };

  const columns = useMemo<ColumnDef<UniverseEntry, unknown>[]>(
    () => [
      { id: "symbol", header: "Symbol", accessorKey: "symbol", meta: { primary: true } },
      { id: "name", header: "Name", accessorKey: "name" },
      { id: "sector", header: "Sector", accessorKey: "sector", meta: { hideOnMobile: true } },
      {
        id: "indices",
        header: "Indices",
        accessorFn: (e) => e.indices.join(", ") || "—",
        meta: { hideOnMobile: true },
      },
      {
        id: "kite",
        header: "Kite",
        accessorKey: "synced",
        cell: ({ getValue }) =>
          getValue() ? (
            <Badge tone="success">Synced</Badge>
          ) : (
            <Badge tone="warning">Not synced</Badge>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Edit ${row.original.symbol}`}
              onClick={() => setEditing({ entry: row.original })}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${row.original.symbol}`}
              onClick={() => setRemoving(row.original.symbol)}
            >
              Remove
            </Button>
          </span>
        ),
      },
    ],
    [],
  );

  const addButton = (
    <Button size="sm" onClick={() => setEditing({ entry: null })}>
      Add stock
    </Button>
  );
  const toolbar = (
    <span className="flex flex-wrap gap-2">
      {addButton}
      <Button
        size="sm"
        variant="secondary"
        disabled={sync.isPending}
        onClick={() => void runSync()}
      >
        {sync.isPending ? "Syncing…" : "Sync with Kite"}
      </Button>
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-text-muted">
        The stocks you can download prices for. After adding one, press{" "}
        <strong>Sync with Kite</strong> (needs today&apos;s Kite login), then queue a download in
        Data jobs.
      </p>
      {syncError && (
        <p role="alert" className="text-body-sm text-loss">
          {syncError}
        </p>
      )}
      {lastSync && lastSync.missing.length > 0 && (
        <p role="alert" className="text-body-sm text-warning-text">
          Not found on NSE: {lastSync.missing.join(", ")}. Check the symbol.
        </p>
      )}
      <DataTable
        caption="Stock list"
        columns={columns}
        data={query.data ?? []}
        getRowId={(e) => e.symbol}
        initialSort={[{ id: "symbol", desc: false }]}
        loading={query.isPending}
        search={{
          label: "Search stocks",
          placeholder: "Symbol, name or sector",
          getText: (e) => `${e.symbol} ${e.name} ${e.sector}`,
        }}
        toolbar={toolbar}
        pageSize={25}
        error={
          query.isError ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : undefined
        }
        emptyState={
          <EmptyState
            icon={<ListOrdered className="h-6 w-6" />}
            title="No stocks yet"
            description="Add the stocks you want to download prices for."
            action={addButton}
          />
        }
      />
      <UniverseEntryModal
        entry={editing?.entry ?? null}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
      <RemoveStockModal symbol={removing} onClose={() => setRemoving(null)} />
    </div>
  );
}
