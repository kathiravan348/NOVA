import type { ColumnDef } from "@tanstack/react-table";
import type { SymbolBreakdown as Row } from "@nova/contracts";
import { useState } from "react";
import { Button, DataTable } from "@nova/ui-core";
import { PnLText, formatPercent, formatQuantity } from "@nova/ui-trading";
import { SymbolsDialog } from "./SymbolsDialog";

export interface SymbolBreakdownProps {
  rows: Row[];
  /** Shows only this symbol's trades in the trades table. */
  onShowTrades: (symbol: string) => void;
}

/** Shared columns for the short result list and its full popup. */
export function symbolColumns(onShowTrades: (symbol: string) => void): ColumnDef<Row, unknown>[] {
  return [
    { id: "symbol", header: "Symbol", accessorKey: "symbol", meta: { primary: true } },
    {
      id: "trades",
      header: "Trades",
      accessorKey: "tradeCount",
      meta: { numeric: true },
      cell: ({ getValue }) => formatQuantity(getValue() as number),
    },
    {
      id: "winRate",
      header: "Win rate",
      accessorKey: "winRatePercent",
      meta: { numeric: true },
      cell: ({ row }) =>
        `${formatPercent(row.original.winRatePercent, { decimals: 0 })} (${row.original.winCount}/${row.original.tradeCount})`,
    },
    {
      id: "net",
      header: "Net P&L",
      accessorKey: "netPnlPaise",
      meta: { numeric: true },
      cell: ({ getValue }) => <PnLText paise={getValue() as number} />,
    },
    {
      id: "average",
      header: "Avg per trade",
      accessorFn: (row) => (row.tradeCount ? Math.round(row.netPnlPaise / row.tradeCount) : 0),
      meta: { numeric: true },
      cell: ({ getValue }) => <PnLText paise={getValue() as number} />,
    },
    {
      id: "actions",
      header: "View",
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Show ${row.original.symbol} trades`}
          onClick={() => onShowTrades(row.original.symbol)}
        >
          Show trades
        </Button>
      ),
    },
  ];
}

/** Best and worst shares, with the full report available in a popup. */
export function SymbolBreakdown({ rows, onShowTrades }: SymbolBreakdownProps) {
  const [open, setOpen] = useState(false);
  const ranked = [...rows].sort(
    (a, b) => b.netPnlPaise - a.netPnlPaise || a.symbol.localeCompare(b.symbol),
  );
  const profitable = rows.filter((row) => row.netPnlPaise > 0).length;
  const columns = symbolColumns(onShowTrades);
  const table = (data: Row[], caption: string, descending = true) => (
    <DataTable
      caption={caption}
      columns={columns}
      data={data}
      getRowId={(r) => r.symbol}
      initialSort={[{ id: "net", desc: descending }]}
      emptyState="No trades in this run"
    />
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-section-title text-text-primary">
          Results by symbol · {rows.length} symbols · {profitable} profitable
        </h3>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          View all {rows.length} symbols
        </Button>
      </div>
      {rows.length <= 10 ? (
        table(ranked, "Results by symbol")
      ) : (
        <>
          <h4 className="text-card-title text-text-primary">Best 5</h4>
          {table(ranked.slice(0, 5), "Best 5")}
          <h4 className="text-card-title text-text-primary">Worst 5</h4>
          {table(ranked.slice(-5), "Worst 5", false)}
        </>
      )}
      <SymbolsDialog open={open} onOpenChange={setOpen} rows={rows} onShowTrades={onShowTrades} />
    </div>
  );
}
