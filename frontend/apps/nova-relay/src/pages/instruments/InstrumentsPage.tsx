import { useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ListOrdered } from "lucide-react";
import type { UniverseEntry } from "@nova/contracts";
import { Badge, Button, DataTable, EmptyState, Select, Tabs, useToast } from "@nova/ui-core";
import { getDataMode, useClearNewListing, useMarketIndices, useUniverse } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { RemoveStockModal } from "./RemoveStockModal";
import { SyncCard } from "./SyncCard";
import { UniverseEntryModal } from "./UniverseEntryModal";

type Editing = { entry: UniverseEntry | null } | null;
const ALL = "";

/** The stock list (D54, D56): every NSE stock after a sync; filter, mark new listings as seen. */
export function InstrumentsPage() {
  const toast = useToast();
  const query = useUniverse();
  const indices = useMarketIndices();
  const clearNew = useClearNewListing();
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [index, setIndex] = useState(ALL);
  const [tab, setTab] = useState("all");

  const columns = useMemo<ColumnDef<UniverseEntry, unknown>[]>(() => {
    const markSeen = async (symbol: string) => {
      try {
        await clearNew.mutateAsync(symbol);
        const demo = getDataMode() === "mock" ? " (demo)" : "";
        toast.show({ title: `${symbol} marked as seen${demo}`, tone: "success" });
      } catch (err) {
        toast.show({
          title: "Could not mark it as seen",
          description: err instanceof Error ? err.message : undefined,
          tone: "danger",
        });
      }
    };
    return [
      {
        id: "symbol",
        header: "Symbol",
        accessorKey: "symbol",
        meta: { primary: true },
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            {row.original.symbol}
            {row.original.newListing && <Badge tone="info">New</Badge>}
          </span>
        ),
      },
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
            {row.original.newListing && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Mark ${row.original.symbol} as seen`}
                onClick={() => void markSeen(row.original.symbol)}
              >
                Mark as seen
              </Button>
            )}
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
    ];
  }, [clearNew, toast]);

  const all = query.data ?? [];
  const inIndex = index === ALL ? all : all.filter((e) => e.indices.includes(index));
  const newOnes = inIndex.filter((e) => e.newListing);
  const indexOptions = [
    { value: ALL, label: "All indices" },
    ...(indices.data ?? []).map((i) => ({
      value: i.name,
      label: `${i.name} (${i.members.toLocaleString("en-IN")})`,
    })),
  ];

  const addButton = (
    <Button size="sm" variant="secondary" onClick={() => setEditing({ entry: null })}>
      Add stock
    </Button>
  );
  const toolbar = (
    <span className="flex flex-wrap items-end gap-2">
      <Select
        label="Index"
        value={index}
        options={indexOptions}
        disabled={indices.isPending}
        onChange={(event) => setIndex(event.target.value)}
      />
      {addButton}
    </span>
  );
  const table = (rows: UniverseEntry[], caption: string, empty: ReactNode) => (
    <DataTable
      caption={caption}
      columns={columns}
      data={rows}
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
      emptyState={empty}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <SyncCard />
      <Tabs
        ariaLabel="Stocks"
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: "all",
            label: `All stocks (${inIndex.length.toLocaleString("en-IN")})`,
            content: table(
              inIndex,
              "Stock list",
              <EmptyState
                icon={<ListOrdered className="h-6 w-6" />}
                title="No stocks yet"
                description="Press Sync with Kite to bring in every NSE stock."
                action={addButton}
              />,
            ),
          },
          {
            value: "new",
            label: `New listings (${newOnes.length})`,
            content: table(
              newOnes,
              "New listings",
              <EmptyState
                icon={<ListOrdered className="h-6 w-6" />}
                title="No new listings"
                description="Stocks that appear on the NSE, for example after an IPO, show up here after a sync."
              />,
            ),
          },
        ]}
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
