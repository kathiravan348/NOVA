import { Link } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Database } from "lucide-react";
import type { UniverseEntry } from "@nova/contracts";
import { DataTable, EmptyState } from "@nova/ui-core";
import { useUniverse } from "@nova/services";
import { QueryError } from "../../components/QueryState";

const columns: ColumnDef<UniverseEntry, unknown>[] = [
  {
    id: "symbol",
    header: "Symbol",
    accessorKey: "symbol",
    meta: { primary: true },
    cell: ({ row }) => (
      <Link className="text-action underline" to={`/live/recorded/${row.original.symbol}`}>
        {row.original.symbol}
      </Link>
    ),
  },
  { id: "name", header: "Name", accessorKey: "name" },
  { id: "sector", header: "Sector", accessorKey: "sector", meta: { hideOnMobile: true } },
];

/** Recorded data (D74 (2)): pick a stock to see what was recorded on each day. */
export function RecordedDataPage() {
  const universe = useUniverse();
  const rows: UniverseEntry[] = universe.data ?? [];
  return (
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
      emptyState={
        <EmptyState
          icon={<Database className="h-6 w-6" />}
          title="No stocks yet"
          description="Sync with Kite on the Instruments page to get the stock list."
        />
      }
    />
  );
}
