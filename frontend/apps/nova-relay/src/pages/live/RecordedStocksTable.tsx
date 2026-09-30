import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { RecorderSettings, UniverseEntry } from "@nova/contracts";
import { Button, DataTable, EmptyState, useToast } from "@nova/ui-core";
import { getDataMode, useUniverse, useUpdateRecorder } from "@nova/services";
import { QueryError } from "../../components/QueryState";

/** The stocks being recorded, with search and Remove. Empty selection means every synced stock. */
export function RecordedStocksTable({ settings }: { settings: RecorderSettings }) {
  const toast = useToast();
  const universe = useUniverse();
  const update = useUpdateRecorder();
  const chosen = settings.symbols;

  const rows = useMemo<UniverseEntry[]>(
    () => (universe.data ?? []).filter((e) => chosen.includes(e.symbol)),
    [universe.data, chosen],
  );

  const remove = async (symbol: string) => {
    try {
      await update.mutateAsync({
        enabled: settings.enabled,
        symbols: chosen.filter((s) => s !== symbol),
      });
      toast.show({
        title: `${symbol} removed${getDataMode() === "mock" ? " (demo)" : ""}`,
        tone: "success",
      });
    } catch (err) {
      toast.show({
        title: "Could not remove the stock",
        description: err instanceof Error ? err.message : undefined,
        tone: "danger",
      });
    }
  };

  const columns: ColumnDef<UniverseEntry, unknown>[] = [
    { id: "symbol", header: "Symbol", accessorKey: "symbol", meta: { primary: true } },
    { id: "name", header: "Name", accessorKey: "name" },
    { id: "sector", header: "Sector", accessorKey: "sector", meta: { hideOnMobile: true } },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Remove ${row.original.symbol}`}
          disabled={update.isPending || chosen.length === 1}
          onClick={() => void remove(row.original.symbol)}
        >
          Remove
        </Button>
      ),
    },
  ];

  if (chosen.length === 0) {
    return (
      <EmptyState
        title="Every synced stock is recorded"
        description="Use Choose stocks to record only some of them."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <DataTable
        caption="Recorded stocks"
        columns={columns}
        data={rows}
        getRowId={(e) => e.symbol}
        loading={universe.isPending}
        error={
          universe.isError ? (
            <QueryError error={universe.error} onRetry={() => void universe.refetch()} />
          ) : undefined
        }
        search={{ label: "Search stocks", getText: (e) => `${e.symbol} ${e.name}` }}
        pageSize={25}
        initialSort={[{ id: "symbol", desc: false }]}
        emptyState="No chosen stock is in the stock list"
      />
      {chosen.length === 1 && (
        <p className="text-body-sm text-text-muted">
          The last stock cannot be removed: an empty list would record every stock. Use Choose
          stocks to change the list.
        </p>
      )}
    </div>
  );
}
