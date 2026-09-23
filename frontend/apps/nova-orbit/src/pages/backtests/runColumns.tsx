import { Link } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { BacktestRun } from "@nova/contracts";
import { StatusBadge } from "@nova/ui-core";
import { formatInr } from "@nova/ui-trading";
import { useStrategies } from "@nova/services";
import { formatIstDate, formatPeriod, runStatusLabel, runStatusTone } from "../../lib/format";
import { describeUniverse, summarizeUniverse } from "../../lib/strategyText";

/** Columns for a list of backtest runs; `withStrategy: false` drops the strategy column. */
export function useRunColumns({ withStrategy = true } = {}): ColumnDef<BacktestRun, unknown>[] {
  const strategies = useStrategies();
  const nameOf = (id: string) => strategies.data?.find((s) => s.id === id)?.name ?? id;
  const columns: (ColumnDef<BacktestRun, unknown> | false)[] = [
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
        </Link>
      ),
    },
    withStrategy && {
      id: "strategy",
      header: "Strategy",
      accessorFn: (r) => nameOf(r.strategyId),
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
      meta: { numeric: true },
      cell: ({ getValue }) => `v${String(getValue())}`,
    },
    {
      id: "universe",
      header: "Symbols",
      accessorFn: (r) => summarizeUniverse(r.universe),
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
      cell: ({ row }) => (
        <StatusBadge
          tone={runStatusTone[row.original.status]}
          label={runStatusLabel[row.original.status]}
        />
      ),
    },
    {
      id: "period",
      header: "Period",
      accessorKey: "from",
      cell: ({ row }) => formatPeriod(row.original.from, row.original.to),
      meta: { hideOnMobile: true },
    },
    {
      id: "capital",
      header: "Capital",
      accessorKey: "initialCapitalPaise",
      meta: { numeric: true },
      cell: ({ getValue }) => formatInr(getValue() as number, { decimals: 0 }),
    },
    {
      id: "createdAt",
      header: "Created",
      accessorKey: "createdAt",
      meta: { numeric: true },
      cell: ({ getValue }) => formatIstDate(getValue() as string),
    },
  ];
  return columns.filter((c): c is ColumnDef<BacktestRun, unknown> => c !== false);
}
