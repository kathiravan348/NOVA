import { Link } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { BacktestRunListItem, BacktestRunSummary } from "@nova/contracts";
import { StatusBadge } from "@nova/ui-core";
import { formatInr, formatPercent, PnLText } from "@nova/ui-trading";
import { useStrategies } from "@nova/services";
import { formatIstDate, formatPeriod, runStatusLabel, runStatusTone } from "../../lib/format";
import { describeUniverse, summarizeUniverse } from "../../lib/strategyText";

function metric(
  key: keyof BacktestRunSummary,
  header: string,
  render: (value: number) => string,
  hideOnMobile = true,
): ColumnDef<BacktestRunListItem, unknown> {
  return {
    id: key,
    header,
    meta: { numeric: true, hideOnMobile },
    cell: ({ row }) => {
      const value = row.original.summary?.[key];
      return value == null ? "—" : render(value);
    },
  };
}

/** Result columns are sorted by the server, across every page. */
export function useRunColumns({ withStrategy = true, recorded = false } = {}): ColumnDef<
  BacktestRunListItem,
  unknown
>[] {
  const strategies = useStrategies();
  const nameOf = (id: string) => strategies.data?.find((s) => s.id === id)?.name ?? id;
  const columns: (ColumnDef<BacktestRunListItem, unknown> | false)[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      meta: { primary: true },
      cell: ({ row }) => (
        <Link
          to={`/backtests/${row.original.id}`}
          className="font-medium text-action-text hover:underline"
        >
          {row.original.name}
          {row.original.version > 1 && (
            <span className="font-normal text-text-muted"> · v{row.original.version}</span>
          )}
        </Link>
      ),
    },
    withStrategy && {
      id: "strategy",
      header: "Strategy",
      accessorFn: (r) => nameOf(r.strategyId),
      meta: { hideOnMobile: true },
      cell: ({ row }) => (
        <span>
          <Link to={`/strategies/${row.original.strategyId}`} className="hover:underline">
            {nameOf(row.original.strategyId)}
          </Link>{" "}
          <span className="text-text-muted">v{row.original.strategyVersion}</span>
        </span>
      ),
    },
    !withStrategy && {
      id: "version",
      header: "Version",
      accessorKey: "strategyVersion",
      meta: { numeric: true, hideOnMobile: true },
      cell: ({ getValue }) => `v${String(getValue())}`,
    },
    {
      id: "universe",
      header: "Symbols",
      accessorFn: (r) => summarizeUniverse(r.universe),
      meta: { hideOnMobile: true },
      cell: ({ row }) => (
        <span title={describeUniverse(row.original.universe)}>
          {summarizeUniverse(row.original.universe)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const { status, progress } = row.original;
        const label =
          status === "running" && progress
            ? `${runStatusLabel.running} · ${progress.percent}%`
            : runStatusLabel[status];
        return <StatusBadge tone={runStatusTone[status]} label={label} />;
      },
    },
    {
      id: "period",
      header: "Period",
      accessorKey: "from",
      cell: ({ row }) => formatPeriod(row.original.from, row.original.to),
      meta: { hideOnMobile: true },
    },
    {
      id: "netPnlPaise",
      header: "Net P&L",
      meta: { numeric: true },
      cell: ({ row }) =>
        row.original.summary ? <PnLText paise={row.original.summary.netPnlPaise} /> : "—",
    },
    metric("returnPercent", "Return", (n) => formatPercent(n, { signed: true })),
    metric("cagrPercent", "CAGR", (n) => formatPercent(n, { signed: true }), false),
    metric("maxDrawdownPercent", "Max DD", (n) => formatPercent(n, { signed: true }), false),
    metric("winRatePercent", "Win rate", (n) => formatPercent(n)),
    metric("tradeCount", "Trades", (n) => n.toLocaleString("en-IN")),
    metric("profitFactor", "Profit factor", (n) => n.toFixed(2)),
    recorded && metric("spreadCostPaise", "Spread cost", (n) => formatInr(n)),
    {
      id: "createdAt",
      header: "Created",
      accessorKey: "createdAt",
      meta: { numeric: true, hideOnMobile: true },
      cell: ({ getValue }) => formatIstDate(getValue() as string),
    },
  ];
  return columns
    .filter((c): c is ColumnDef<BacktestRunListItem, unknown> => c !== false)
    .map((column) => ({ ...column, enableSorting: false }));
}
