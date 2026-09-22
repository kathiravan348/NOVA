import { Link } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Workflow } from "lucide-react";
import type { Strategy } from "@nova/contracts";
import { DataTable, EmptyState, StatusBadge } from "@nova/ui-core";
import { useStrategies } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import {
  formatIstDate,
  segmentLabel,
  strategyStatusLabel,
  strategyStatusTone,
  timeframeLabel,
} from "../../lib/format";

const latestSpec = (s: Strategy) => s.versions.find((v) => v.version === s.latestVersion)!.spec;

const columns: ColumnDef<Strategy, unknown>[] = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    meta: { primary: true },
    cell: ({ row }) => (
      <Link
        to={`/strategies/${row.original.id}`}
        className="font-medium text-action-text hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => (
      <StatusBadge
        tone={strategyStatusTone[row.original.status]}
        label={strategyStatusLabel[row.original.status]}
      />
    ),
  },
  {
    id: "mode",
    header: "Mode",
    accessorFn: (s) => (latestSpec(s).mode === "visual" ? "Visual" : "Python"),
  },
  {
    id: "segment",
    header: "Segment",
    accessorFn: (s) => segmentLabel[latestSpec(s).segment],
    meta: { hideOnMobile: true },
  },
  {
    id: "timeframe",
    header: "Timeframe",
    accessorFn: (s) => timeframeLabel[latestSpec(s).timeframe],
    meta: { hideOnMobile: true },
  },
  {
    id: "version",
    header: "Version",
    accessorKey: "latestVersion",
    meta: { numeric: true },
    cell: ({ getValue }) => `v${String(getValue())}`,
  },
  {
    id: "updatedAt",
    header: "Updated",
    accessorKey: "updatedAt",
    meta: { numeric: true },
    cell: ({ getValue }) => formatIstDate(getValue() as string),
  },
];

export function StrategiesPage() {
  const query = useStrategies();
  return (
    <DataTable
      caption="Strategies"
      columns={columns}
      data={query.data ?? []}
      getRowId={(s) => s.id}
      initialSort={[{ id: "updatedAt", desc: true }]}
      loading={query.isPending}
      error={
        query.isError ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : undefined
      }
      emptyState={
        <EmptyState
          icon={<Workflow className="h-6 w-6" />}
          title="No strategies yet"
          description="Strategies you build will appear here."
        />
      }
    />
  );
}
