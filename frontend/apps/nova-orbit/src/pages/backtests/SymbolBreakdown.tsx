import type { ColumnDef } from "@tanstack/react-table";
import type { SymbolBreakdown as Row } from "@nova/contracts";
import { Button, DataTable } from "@nova/ui-core";
import { PnLText, formatPercent, formatQuantity } from "@nova/ui-trading";

export interface SymbolBreakdownProps {
  rows: Row[];
  /** Shows only this symbol's trades in the trades table. */
  onShowTrades: (symbol: string) => void;
}

/** Per-symbol results of a run (R2), as sent by the backend in `BacktestResult.bySymbol`. */
export function SymbolBreakdown({ rows, onShowTrades }: SymbolBreakdownProps) {
  const columns: ColumnDef<Row, unknown>[] = [
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

  return (
    <DataTable
      caption="Results by symbol"
      columns={columns}
      data={rows}
      getRowId={(r) => r.symbol}
      initialSort={[{ id: "net", desc: true }]}
      emptyState="No trades in this run"
    />
  );
}
