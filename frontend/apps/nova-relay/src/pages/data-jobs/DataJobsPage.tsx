import { Link } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Database } from "lucide-react";
import type { DataJob } from "@nova/contracts";
import { DataTable, EmptyState, StatusBadge } from "@nova/ui-core";
import { formatPercent, formatQuantity } from "@nova/ui-trading";
import { useDataJobs } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatIstShort, formatPeriod } from "../../lib/format";
import { jobStatusLabel, jobStatusTone, jobTypeLabel } from "../../lib/labels";

const symbolsText = (symbols: string[]) =>
  symbols.length > 3
    ? `${symbols.slice(0, 3).join(", ")} +${symbols.length - 3} more`
    : symbols.join(", ");

const columns: ColumnDef<DataJob, unknown>[] = [
  {
    id: "job",
    header: "Job",
    accessorFn: (j) => jobTypeLabel[j.type],
    meta: { primary: true },
    cell: ({ row }) => (
      <span className="flex flex-col">
        <Link
          to={`/data-jobs/${row.original.id}`}
          className="whitespace-nowrap font-medium text-action-text hover:underline"
        >
          {jobTypeLabel[row.original.type]}
        </Link>
        <span className="text-body-sm text-text-muted">{row.original.timeframe ?? "Ticks"}</span>
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => (
      <StatusBadge
        tone={jobStatusTone[row.original.status]}
        label={jobStatusLabel[row.original.status]}
      />
    ),
  },
  { id: "symbols", header: "Symbols", accessorFn: (j) => symbolsText(j.symbols) },
  {
    id: "period",
    header: "Period",
    accessorFn: (j) => (j.from && j.to ? formatPeriod(j.from, j.to) : "—"),
    meta: { hideOnMobile: true },
  },
  {
    id: "progress",
    header: "Progress",
    accessorKey: "progressPercent",
    meta: { numeric: true },
    cell: ({ getValue }) => formatPercent(getValue() as number, { decimals: 0 }),
  },
  {
    id: "rows",
    header: "Rows",
    accessorKey: "rowsWritten",
    meta: { numeric: true },
    cell: ({ getValue }) => formatQuantity(getValue() as number),
  },
  {
    id: "createdAt",
    header: "Created",
    accessorKey: "createdAt",
    meta: { numeric: true },
    cell: ({ getValue }) => formatIstShort(getValue() as string),
  },
];

export function DataJobsPage() {
  const query = useDataJobs();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-text-muted">
        Downloads and recordings run in NOVA Atlas (Stage B). This list is demo data.
      </p>
      <DataTable
        caption="Data jobs"
        columns={columns}
        data={query.data ?? []}
        getRowId={(j) => j.id}
        initialSort={[{ id: "createdAt", desc: true }]}
        loading={query.isPending}
        error={
          query.isError ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : undefined
        }
        emptyState={
          <EmptyState
            icon={<Database className="h-6 w-6" />}
            title="No data jobs"
            description="Download and recording jobs will appear here."
          />
        }
      />
    </div>
  );
}
