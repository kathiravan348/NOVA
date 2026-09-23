import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Trade } from "@nova/contracts";
import { Button, DataTable, Modal, Select } from "@nova/ui-core";
import { ChargesBreakdown, PnLText, PriceText, formatInr } from "@nova/ui-trading";
import { formatIstDateTime, formatIstShort } from "../../lib/format";

export interface TradesTableProps {
  trades: Trade[];
  loading?: boolean;
  error?: React.ReactNode;
  /** Symbol filter (R2); empty string = all symbols. */
  symbol?: string;
  onSymbolChange?: (symbol: string) => void;
}

export function TradesTable({
  trades,
  loading,
  error,
  symbol = "",
  onSymbolChange,
}: TradesTableProps) {
  const [chargesFor, setChargesFor] = useState<Trade | null>(null);
  const symbols = useMemo(() => [...new Set(trades.map((t) => t.symbol))].sort(), [trades]);
  const shown = useMemo(
    () => (symbol ? trades.filter((t) => t.symbol === symbol) : trades),
    [trades, symbol],
  );

  const columns: ColumnDef<Trade, unknown>[] = [
    { id: "symbol", header: "Symbol", accessorKey: "symbol", meta: { primary: true } },
    {
      id: "side",
      header: "Side",
      accessorKey: "side",
      cell: ({ getValue }) => (getValue() === "buy" ? "Buy" : "Sell"),
    },
    { id: "qty", header: "Qty", accessorKey: "qty", meta: { numeric: true } },
    {
      id: "entry",
      header: "Entry",
      accessorKey: "entryAt",
      meta: { numeric: true },
      cell: ({ row }) => (
        <span className="flex flex-col items-end">
          <PriceText paise={row.original.entryPricePaise} />
          <span className="text-body-sm text-text-muted">
            {formatIstShort(row.original.entryAt)}
          </span>
        </span>
      ),
    },
    {
      id: "exit",
      header: "Exit",
      accessorKey: "exitAt",
      meta: { numeric: true },
      cell: ({ row }) =>
        row.original.exitAt && row.original.exitPricePaise !== null ? (
          <span className="flex flex-col items-end">
            <PriceText paise={row.original.exitPricePaise} />
            <span className="text-body-sm text-text-muted">
              {formatIstShort(row.original.exitAt)}
            </span>
          </span>
        ) : (
          "Open"
        ),
    },
    {
      id: "gross",
      header: "Gross",
      accessorKey: "grossPnlPaise",
      meta: { numeric: true, hideOnMobile: true },
      cell: ({ getValue }) => <PnLText paise={getValue() as number} />,
    },
    {
      id: "charges",
      header: "Charges",
      accessorFn: (t) => t.charges.totalPaise,
      meta: { numeric: true },
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="font-mono"
          aria-label={`Charges for ${row.original.symbol} trade: ${formatInr(row.original.charges.totalPaise)}`}
          onClick={() => setChargesFor(row.original)}
        >
          {formatInr(row.original.charges.totalPaise)}
        </Button>
      ),
    },
    {
      id: "net",
      header: "Net",
      accessorKey: "netPnlPaise",
      meta: { numeric: true },
      cell: ({ getValue }) => <PnLText paise={getValue() as number} />,
    },
  ];

  return (
    <>
      <DataTable
        caption="Trades"
        columns={columns}
        data={shown}
        getRowId={(t) => t.id}
        toolbar={
          onSymbolChange && symbols.length > 1 ? (
            <Select
              label="Symbol"
              value={symbol}
              onChange={(e) => onSymbolChange(e.target.value)}
              options={[
                { value: "", label: "All symbols" },
                ...symbols.map((s) => ({ value: s, label: s })),
              ]}
              containerClassName="md:w-48"
            />
          ) : undefined
        }
        initialSort={[{ id: "entry", desc: false }]}
        loading={loading}
        error={error}
        emptyState="No trades in this run"
      />
      <Modal
        open={chargesFor !== null}
        onOpenChange={(open) => !open && setChargesFor(null)}
        title={chargesFor ? `Charges · ${chargesFor.symbol}` : "Charges"}
        description={chargesFor ? formatIstDateTime(chargesFor.entryAt) : undefined}
      >
        {chargesFor && (
          <ChargesBreakdown charges={chargesFor.charges} hideZero className="max-w-none border-0" />
        )}
      </Modal>
    </>
  );
}
