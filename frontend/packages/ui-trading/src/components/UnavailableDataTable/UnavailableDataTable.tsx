import { useMemo, type ReactNode } from "react";
import type { UnavailableDay } from "@nova/contracts";
import { Button, DataTable, StatusBadge, type DataTableProps } from "@nova/ui-core";

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});
const checkFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export interface UnavailableDataTableProps {
  rows: UnavailableDay[];
  loading?: boolean;
  error?: ReactNode;
  onRecheck?: (row: UnavailableDay) => void;
}

/** Exact source gaps and successful-check history; prices and session inference are supplied by props. */
export function UnavailableDataTable({
  rows,
  loading,
  error,
  onRecheck,
}: UnavailableDataTableProps) {
  const columns = useMemo<DataTableProps<UnavailableDay, unknown>["columns"]>(
    () => [
      { id: "symbol", header: "Symbol", accessorKey: "symbol", meta: { primary: true } },
      {
        id: "day",
        header: "Unavailable date",
        accessorKey: "day",
        cell: ({ row }) => dayFormat.format(new Date(`${row.original.day}T00:00:00+05:30`)),
      },
      { id: "timeframe", header: "Timeframe", accessorKey: "timeframe" },
      { id: "broker", header: "Broker", accessorKey: "broker" },
      { id: "reason", header: "Response", cell: () => "No usable candle returned" },
      {
        id: "firstCheckedAt",
        header: "First checked",
        accessorKey: "firstCheckedAt",
        meta: { hideOnMobile: true },
        cell: ({ row }) => `${checkFormat.format(new Date(row.original.firstCheckedAt))} IST`,
      },
      {
        id: "lastCheckedAt",
        header: "Last checked",
        accessorKey: "lastCheckedAt",
        cell: ({ row }) => `${checkFormat.format(new Date(row.original.lastCheckedAt))} IST`,
      },
      { id: "attempts", header: "Checks", accessorKey: "attempts", meta: { numeric: true } },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <StatusBadge
            tone={row.original.status === "resolved" ? "success" : "warning"}
            label={row.original.status === "resolved" ? "Resolved" : "Broker unavailable"}
          />
        ),
      },
      {
        id: "job",
        header: "Last job",
        cell: ({ row }) =>
          row.original.lastJobId ? (
            <a
              className="rounded-xs text-text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              href={`/data-jobs/${row.original.lastJobId}`}
            >
              View job
            </a>
          ) : (
            "—"
          ),
      },
      {
        id: "check",
        header: "Recheck",
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="secondary"
            disabled={!onRecheck}
            onClick={() => onRecheck?.(row.original)}
            aria-label={`Check ${row.original.symbol} ${row.original.day} again`}
          >
            Check again
          </Button>
        ),
      },
    ],
    [onRecheck],
  );

  return (
    <DataTable<UnavailableDay>
      caption="Unavailable data"
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      loading={loading}
      error={error}
      pageSize={25}
      search={{
        label: "Search unavailable dates",
        getText: (row) => `${row.symbol} ${row.day} ${row.broker}`,
      }}
      emptyState="No broker-unavailable dates recorded for these filters."
    />
  );
}
