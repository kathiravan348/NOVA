import { Link } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { BacktestVersion } from "@nova/contracts";
import { DataTable, StatusBadge } from "@nova/ui-core";
import { PnLText, formatPercent } from "@nova/ui-trading";
import { formatPeriod, runStatusLabel, runStatusTone } from "../../lib/format";
import { describeUniverse, summarizeUniverse } from "../../lib/strategyText";
import { DeleteBacktestButton } from "./DeleteBacktestButton";

const signed = (value: number) => formatPercent(value, { decimals: 2, signed: true });

function columns(currentId: string, newestId: string): ColumnDef<BacktestVersion, unknown>[] {
  return [
    {
      id: "version",
      header: "Version",
      accessorKey: "version",
      meta: { primary: true },
      cell: ({ row }) =>
        row.original.runId === currentId ? (
          <span className="font-medium text-text-primary">v{row.original.version} (this page)</span>
        ) : (
          <Link
            to={`/backtests/${row.original.runId}`}
            className="font-medium text-action-text hover:underline"
          >
            v{row.original.version}
          </Link>
        ),
    },
    {
      id: "strategyVersion",
      header: "Strategy",
      accessorKey: "strategyVersion",
      cell: ({ getValue }) => `v${String(getValue())}`,
    },
    {
      id: "universe",
      header: "Symbols",
      accessorFn: (v) => summarizeUniverse(v.universe),
      cell: ({ row }) => (
        <span title={describeUniverse(row.original.universe)}>
          {summarizeUniverse(row.original.universe)}
        </span>
      ),
    },
    {
      id: "period",
      header: "Period",
      accessorKey: "from",
      cell: ({ row }) => formatPeriod(row.original.from, row.original.to),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge
          tone={runStatusTone[row.original.status]}
          label={runStatusLabel[row.original.status]}
        />
      ),
    },
    {
      id: "net",
      header: "Net P&L",
      accessorFn: (v) => v.metrics?.netPnlPaise ?? null,
      meta: { numeric: true },
      cell: ({ row }) =>
        row.original.metrics ? <PnLText paise={row.original.metrics.netPnlPaise} /> : "—",
    },
    {
      id: "return",
      header: "Return",
      accessorFn: (v) => v.metrics?.returnPercent ?? null,
      meta: { numeric: true },
      cell: ({ row }) => (row.original.metrics ? signed(row.original.metrics.returnPercent) : "—"),
    },
    {
      id: "winRate",
      header: "Win rate",
      accessorFn: (v) => v.metrics?.winRatePercent ?? null,
      meta: { numeric: true },
      cell: ({ row }) =>
        row.original.metrics
          ? formatPercent(row.original.metrics.winRatePercent, { decimals: 0 })
          : "—",
    },
    {
      id: "drawdown",
      header: "Max drawdown",
      accessorFn: (v) => v.metrics?.maxDrawdownPercent ?? null,
      meta: { numeric: true },
      cell: ({ row }) =>
        row.original.metrics ? signed(row.original.metrics.maxDrawdownPercent) : "—",
    },
    {
      id: "afterTaxCagr",
      header: "After-tax CAGR",
      accessorFn: (v) => v.metrics?.afterTaxCagrPercent ?? null,
      meta: { numeric: true, hideOnMobile: true },
      cell: ({ row }) => {
        const value = row.original.metrics?.afterTaxCagrPercent;
        return value === null || value === undefined ? "—" : signed(value);
      },
    },
    {
      id: "trades",
      header: "Trades",
      accessorFn: (v) => v.metrics?.tradeCount ?? null,
      meta: { numeric: true },
      cell: ({ row }) => row.original.metrics?.tradeCount ?? "—",
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.runId === newestId || row.original.status === "running" ? null : (
          <DeleteBacktestButton
            runId={row.original.runId}
            name={row.original.name}
            version={row.original.version}
            scope="version"
          />
        ),
    },
  ];
}

/** Every version of a backtest with its settings and key numbers (D60). */
export function VersionsTable({
  versions,
  currentId,
}: {
  versions: BacktestVersion[];
  currentId: string;
}) {
  const newestId = versions[0]?.runId ?? "";
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-section-title text-text-primary">Versions</h3>
      <DataTable
        caption="Versions"
        columns={columns(currentId, newestId)}
        data={versions}
        getRowId={(v) => v.runId}
        initialSort={[{ id: "version", desc: true }]}
      />
    </section>
  );
}
