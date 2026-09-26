import { useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Instrument } from "@nova/contracts";
import { Badge, Checkbox, DataTable, Select } from "@nova/ui-core";
import { formatPercent, formatPrice, formatQuantity } from "@nova/ui-trading";
import { formatCalendarDate, formatPeriod } from "../lib/format";

/** A backtest period; instruments whose data does not cover it are flagged. */
export interface Period {
  from: string;
  to: string;
}

export const coversPeriod = (i: Instrument, p: Period): boolean =>
  i.dataFrom <= p.from && i.dataTo >= p.to;

export interface InstrumentTableProps {
  instruments: Instrument[];
  caption: string;
  loading?: boolean;
  error?: ReactNode;
  /** Checkbox selection by symbol (symbol picker). */
  selected?: string[];
  onSelectedChange?: (symbols: string[]) => void;
  /** Adds a data-coverage flag for this period. */
  period?: Period;
  /** Renders the symbol cell, e.g. as a link. */
  renderSymbol?: (instrument: Instrument) => ReactNode;
  pageSize?: number;
}

const ALL = "all";

function useColumns(
  period: Period | undefined,
  renderSymbol: InstrumentTableProps["renderSymbol"],
): ColumnDef<Instrument, unknown>[] {
  return useMemo(
    () => [
      {
        id: "symbol",
        header: "Symbol",
        accessorKey: "symbol",
        meta: { primary: true },
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">
              {renderSymbol ? renderSymbol(row.original) : row.original.symbol}
            </span>
            <span className="text-body-sm text-text-muted">{row.original.name}</span>
          </span>
        ),
      },
      { id: "sector", header: "Sector", accessorKey: "sector", meta: { hideOnMobile: true } },
      {
        id: "indices",
        header: "Index",
        accessorFn: (i) => i.indices.join(", "),
        enableSorting: false,
        meta: { hideOnMobile: true },
        cell: ({ row }) => row.original.indices.join(", ") || "—",
      },
      {
        id: "lastClose",
        header: "Last close",
        accessorKey: "lastClosePaise",
        meta: { numeric: true },
        cell: ({ getValue }) => formatPrice(getValue() as number),
      },
      {
        id: "change",
        header: "Day change",
        accessorKey: "changePercent",
        meta: { numeric: true },
        cell: ({ getValue }) => {
          const v = getValue() as number;
          return (
            <span className={v > 0 ? "text-profit" : v < 0 ? "text-loss" : undefined}>
              {formatPercent(v, { signed: true })}
            </span>
          );
        },
      },
      {
        id: "range52w",
        header: "52-week range",
        accessorKey: "low52wPaise",
        enableSorting: false,
        meta: { numeric: true, hideOnMobile: true },
        cell: ({ row }) =>
          `${formatPrice(row.original.low52wPaise)} – ${formatPrice(row.original.high52wPaise)}`,
      },
      {
        id: "volume",
        header: "Avg volume",
        accessorKey: "avgDailyVolume",
        meta: { numeric: true, hideOnMobile: true },
        cell: ({ getValue }) => formatQuantity(getValue() as number),
      },
      {
        id: "lotSize",
        header: "F&O lot",
        accessorFn: (i) => i.lotSize ?? 0,
        meta: { numeric: true, mobileLabel: "F&O lot size" },
        cell: ({ row }) =>
          row.original.lotSize === null ? "Not in F&O" : formatQuantity(row.original.lotSize),
      },
      {
        id: "data",
        header: "Data",
        accessorKey: "dataFrom",
        meta: { mobileLabel: "Data available" },
        cell: ({ row }) => {
          const i = row.original;
          const range = formatPeriod(i.dataFrom, i.dataTo);
          if (!period || coversPeriod(i, period)) return range;
          return (
            <span className="flex flex-col items-start gap-1">
              <Badge tone="warning">Partial data</Badge>
              <span className="text-body-sm text-text-muted">
                {`From ${formatCalendarDate(i.dataFrom)}`}
              </span>
            </span>
          );
        },
      },
    ],
    [period, renderSymbol],
  );
}

/** Searchable, filterable instrument list (R2) for the symbol picker and the market data page. */
export function InstrumentTable({
  instruments,
  caption,
  loading,
  error,
  selected,
  onSelectedChange,
  period,
  renderSymbol,
  pageSize = 10,
}: InstrumentTableProps) {
  const [index, setIndex] = useState(ALL);
  const [sector, setSector] = useState(ALL);
  const [fnoOnly, setFnoOnly] = useState(false);
  const columns = useColumns(period, renderSymbol);

  const sectors = useMemo(
    () => [...new Set(instruments.map((i) => i.sector))].sort(),
    [instruments],
  );
  // Only indices that these instruments belong to (D56: any NSE index).
  const indices = useMemo(
    () => [...new Set(instruments.flatMap((i) => i.indices))].sort(),
    [instruments],
  );
  // Memoised: DataTable goes back to page 1 whenever `data` changes identity.
  const rows = useMemo(
    () =>
      instruments.filter(
        (i) =>
          (index === ALL || i.indices.some((x) => x === index)) &&
          (sector === ALL || i.sector === sector) &&
          (!fnoOnly || i.lotSize !== null),
      ),
    [instruments, index, sector, fnoOnly],
  );

  return (
    <DataTable
      caption={caption}
      columns={columns}
      data={rows}
      getRowId={(i) => i.symbol}
      pageSize={pageSize}
      loading={loading}
      error={error}
      selectedIds={selected}
      onSelectedIdsChange={onSelectedChange}
      search={{
        label: "Search",
        placeholder: "Symbol or name",
        getText: (i) => `${i.symbol} ${i.name}`,
      }}
      toolbar={
        <>
          <Select
            label="Index"
            value={index}
            onChange={(e) => setIndex(e.target.value)}
            options={[
              { value: ALL, label: "All indices" },
              ...indices.map((v) => ({ value: v, label: v })),
            ]}
            containerClassName="md:w-44"
          />
          <Select
            label="Sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            options={[
              { value: ALL, label: "All sectors" },
              ...sectors.map((v) => ({ value: v, label: v })),
            ]}
            containerClassName="md:w-48"
          />
          <Checkbox
            label="F&O only"
            checked={fnoOnly}
            onCheckedChange={(v) => setFnoOnly(v === true)}
            containerClassName="md:pb-2"
          />
        </>
      }
      emptyState="No instruments match these filters."
    />
  );
}
