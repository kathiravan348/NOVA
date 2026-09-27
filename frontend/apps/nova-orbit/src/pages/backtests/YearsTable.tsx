import type { ColumnDef } from "@tanstack/react-table";
import type { YearRow } from "@nova/contracts";
import { Badge, Card, DataTable } from "@nova/ui-core";
import { PnLText, formatPercent } from "@nova/ui-trading";
import { formatPeriod } from "../../lib/format";

/** The D62 (8) pass mark: no 12-month block may lose more than this. */
export const WORST_YEAR_PERCENT = -5;

const signed = (value: number) => formatPercent(value, { signed: true });

function Percent({ value }: { value: number }) {
  const tone = value > 0 ? "text-profit" : value < 0 ? "text-loss" : "text-text-primary";
  return <span className={`font-mono ${tone}`}>{signed(value)}</span>;
}

const columns: ColumnDef<YearRow, unknown>[] = [
  {
    id: "year",
    header: "Year",
    accessorKey: "year",
    meta: { primary: true },
    cell: ({ row }) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>
          Year {row.original.year} · {formatPeriod(row.original.from, row.original.to)}
        </span>
        {row.original.returnPercent < WORST_YEAR_PERCENT && <Badge tone="danger">Below −5%</Badge>}
      </span>
    ),
  },
  {
    id: "return",
    header: "Return",
    accessorKey: "returnPercent",
    meta: { numeric: true },
    cell: ({ row }) => <Percent value={row.original.returnPercent} />,
  },
  {
    id: "profit",
    header: "Profit",
    accessorKey: "profitPaise",
    meta: { numeric: true },
    cell: ({ row }) => <PnLText paise={row.original.profitPaise} />,
  },
  {
    id: "drawdown",
    header: "Max drawdown",
    accessorKey: "maxDrawdownPercent",
    meta: { numeric: true },
    cell: ({ row }) => (
      <span className="font-mono">{formatPercent(row.original.maxDrawdownPercent)}</span>
    ),
  },
  {
    id: "benchmark",
    header: "Benchmark",
    accessorFn: (y) => y.benchmarkPercent,
    meta: { numeric: true },
    cell: ({ row }) =>
      row.original.benchmarkPercent === null ? (
        "—"
      ) : (
        <Percent value={row.original.benchmarkPercent} />
      ),
  },
];

/** 12-month blocks from the start date (D62 (6)); hidden when the run has none (older runs). */
export function YearsTable({ years }: { years: YearRow[] }) {
  if (years.length === 0) return null;
  return (
    <Card title="Year by year">
      <DataTable
        caption="Year by year"
        columns={columns}
        data={years}
        getRowId={(y) => String(y.year)}
        initialSort={[{ id: "year", desc: false }]}
        pageSize={years.length}
      />
    </Card>
  );
}
