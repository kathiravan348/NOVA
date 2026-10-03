import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { BacktestRun, LedgerDay } from "@nova/contracts";
import { useBacktestLedger, useStrategy } from "@nova/services";
import { Button, DataTable, DateTimePicker, Input, Modal, Pager, Switch } from "@nova/ui-core";
import { PnLText, formatInr } from "@nova/ui-trading";
import { ChevronDown, ChevronRight } from "lucide-react";
import { QueryError } from "../../components/QueryState";
import { formatCalendarDate } from "../../lib/format";
import { TimelineDayEvents } from "./TimelineDayEvents";

interface TimelineDialogProps {
  run: BacktestRun;
  onOpenChange: (open: boolean) => void;
}

export function TimelineDialog({ run, onOpenChange }: TimelineDialogProps) {
  const [stock, setStock] = useState("");
  const [symbol, setSymbol] = useState("");
  const [from, setFrom] = useState<string | undefined>(run.from);
  const [to, setTo] = useState<string | undefined>(run.to);
  const [allDays, setAllDays] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expanded, setExpanded] = useState<string[]>([]);
  useEffect(() => {
    if (stock.trim().toUpperCase() === symbol) return;
    const timer = setTimeout(() => {
      setSymbol(stock.trim().toUpperCase());
      setPage(1);
      setExpanded([]);
    }, 400);
    return () => clearTimeout(timer);
  }, [stock, symbol]);
  const query = useBacktestLedger(
    run.id,
    { symbol: symbol || undefined, from, to, allDays },
    { page, pageSize },
  );
  const strategy = useStrategy(run.strategyId);
  const spec = strategy.data?.versions.find((v) => v.version === run.strategyVersion)?.spec;
  const averaging = Boolean(spec && "averaging" in spec && spec.averaging);
  const toggle = (date: string) =>
    setExpanded((current) =>
      current.includes(date) ? current.filter((d) => d !== date) : [...current, date],
    );
  const reset = () => {
    setPage(1);
    setExpanded([]);
  };
  const bound = (value: string | null) =>
    value ? (value < run.from ? run.from : value > run.to ? run.to : value) : undefined;
  const columns: ColumnDef<LedgerDay, unknown>[] = [
    {
      id: "date",
      header: "Date",
      accessorKey: "date",
      meta: { primary: true },
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded.includes(row.original.date)}
          aria-label={`${expanded.includes(row.original.date) ? "Collapse" : "Expand"} ${formatCalendarDate(row.original.date)}`}
          onClick={() => toggle(row.original.date)}
        >
          {expanded.includes(row.original.date) ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
          {formatCalendarDate(row.original.date)}
        </Button>
      ),
    },
    { id: "buys", header: "Buys", accessorKey: "buys", meta: { numeric: true } },
    { id: "sells", header: "Sells", accessorKey: "sells", meta: { numeric: true } },
    ...(
      [
        ["boughtPaise", "Bought"],
        ["soldPaise", "Sold"],
        ["chargesPaise", "Charges"],
      ] as const
    ).map(([key, label]) => ({
      id: key,
      header: label,
      accessorKey: key,
      meta: { numeric: true },
      cell: ({ row }: { row: { original: LedgerDay } }) => formatInr(row.original[key]),
    })),
    {
      id: "net",
      header: "Day P&L",
      accessorKey: "netPnlPaise",
      meta: { numeric: true },
      cell: ({ row }) => <PnLText paise={row.original.netPnlPaise} />,
    },
    ...(
      [
        ["cashPaise", "Cash"],
        ["holdingsPaise", "Holdings"],
        ["equityPaise", "Equity"],
      ] as const
    ).map(([key, label]) => ({
      id: key,
      header: label,
      accessorKey: key,
      meta: { numeric: true },
      cell: ({ row }: { row: { original: LedgerDay } }) => formatInr(row.original[key]),
    })),
  ];
  columns.forEach((column) => {
    column.enableSorting = false;
  });
  return (
    <Modal open onOpenChange={onOpenChange} title="Timeline" description={run.name} size="xl">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Stock"
            type="search"
            placeholder="All stocks"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
          />
          <DateTimePicker
            label="From"
            mode="date"
            value={from}
            min={run.from}
            max={to ?? run.to}
            onChange={(value) => {
              setFrom(bound(value));
              reset();
            }}
          />
          <DateTimePicker
            label="To"
            mode="date"
            value={to}
            min={from ?? run.from}
            max={run.to}
            onChange={(value) => {
              setTo(bound(value));
              reset();
            }}
          />
        </div>
        <Switch
          label="Show days without trades"
          checked={allDays}
          onCheckedChange={(value) => {
            setAllDays(value);
            reset();
          }}
        />
        <p className="text-body-sm text-text-muted">
          Cash is money available. Holdings is the value of stocks still held. Equity is cash plus
          holdings. These remain the whole portfolio when you filter a stock.
        </p>
        <DataTable
          caption="Day ledger"
          columns={columns}
          data={query.data ?? []}
          getRowId={(day) => day.date}
          loading={query.isPending}
          emptyState="No trades in these days"
          error={
            query.isError ? (
              <QueryError error={query.error} onRetry={() => void query.refetch()} />
            ) : undefined
          }
          renderRowDetails={(day) =>
            expanded.includes(day.date) ? (
              <TimelineDayEvents
                runId={run.id}
                date={day.date}
                symbol={symbol || undefined}
                recorded={run.dataSource === "recorded"}
                averaging={averaging}
              />
            ) : null
          }
        />
        <Pager
          page={page}
          pageSize={pageSize}
          total={query.total}
          loading={query.isFetching}
          onPageChange={(value) => {
            setPage(value);
            setExpanded([]);
          }}
          onPageSizeChange={(value) => {
            setPageSize(value);
            reset();
          }}
        />
      </div>
    </Modal>
  );
}
