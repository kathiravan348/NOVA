import type { ColumnDef } from "@tanstack/react-table";
import type { LedgerEvent } from "@nova/contracts";
import { useBacktestLedgerEvents } from "@nova/services";
import { DataTable } from "@nova/ui-core";
import { PnLText, formatInr } from "@nova/ui-trading";
import { formatInTimeZone } from "date-fns-tz";
import { QueryError } from "../../components/QueryState";
import { exitReasonLabel, formatCalendarDate } from "../../lib/format";

interface TimelineDayEventsProps {
  runId: string;
  date: string;
  symbol?: string;
  recorded: boolean;
  averaging: boolean;
}

export function TimelineDayEvents({
  runId,
  date,
  symbol,
  recorded,
  averaging,
}: TimelineDayEventsProps) {
  const query = useBacktestLedgerEvents(runId, date, symbol);
  const columns: ColumnDef<LedgerEvent, unknown>[] = [
    {
      id: "at",
      header: "Time (IST)",
      accessorKey: "at",
      meta: { numeric: true },
      cell: ({ row }) =>
        formatInTimeZone(row.original.at, "Asia/Kolkata", recorded ? "HH:mm:ss" : "HH:mm"),
    },
    { id: "symbol", header: "Stock", accessorKey: "symbol", meta: { primary: true } },
    {
      id: "side",
      header: "Buy/Sell",
      accessorKey: "side",
      cell: ({ row }) => (row.original.side === "buy" ? "Buy" : "Sell"),
    },
    { id: "qty", header: "Qty", accessorKey: "qty", meta: { numeric: true } },
    ...(
      [
        ["pricePaise", "Price"],
        ["amountPaise", "Amount"],
        ["chargesPaise", "Charges"],
      ] as const
    ).map(([key, label]) => ({
      id: key,
      header: label,
      accessorKey: key,
      meta: { numeric: true },
      cell: ({ row }: { row: { original: LedgerEvent } }) => formatInr(row.original[key]),
    })),
    {
      id: "net",
      header: "Net P&L",
      accessorKey: "netPnlPaise",
      meta: { numeric: true },
      cell: ({ row }) =>
        row.original.netPnlPaise === null ? "—" : <PnLText paise={row.original.netPnlPaise} />,
    },
    {
      id: "reason",
      header: "Reason",
      accessorKey: "reason",
      cell: ({ row }) => (row.original.reason ? exitReasonLabel[row.original.reason] : "—"),
    },
    {
      id: "cash",
      header: "Cash after",
      accessorKey: "cashAfterPaise",
      meta: { numeric: true },
      cell: ({ row }) => formatInr(row.original.cashAfterPaise),
    },
  ];
  columns.forEach((column) => {
    column.enableSorting = false;
  });
  return (
    <section className="flex flex-col gap-3" aria-label={`Events for ${formatCalendarDate(date)}`}>
      <h3 className="text-section-title text-text-primary">
        Events for {formatCalendarDate(date)}
      </h3>
      <DataTable
        caption={`Events for ${formatCalendarDate(date)}`}
        columns={columns}
        data={query.data ?? []}
        loading={query.isPending}
        emptyState="No trades in this day"
        error={
          query.isError ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : undefined
        }
      />
      {averaging && query.data?.some((event) => event.side === "buy") && (
        <p className="text-body-sm text-text-muted">
          Added buys are shown as one buy at the average price.
        </p>
      )}
    </section>
  );
}
