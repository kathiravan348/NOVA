import { Link } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3, Play } from "lucide-react";
import type { BacktestRun } from "@nova/contracts";
import { Button, DataTable, EmptyState, StatusBadge } from "@nova/ui-core";
import { formatInr } from "@nova/ui-trading";
import { useBacktests, useStrategies } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatIstDate, formatPeriod, runStatusLabel, runStatusTone } from "../../lib/format";

function useColumns(): ColumnDef<BacktestRun, unknown>[] {
  const strategies = useStrategies();
  const nameOf = (id: string) => strategies.data?.find((s) => s.id === id)?.name ?? id;
  return [
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
    {
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
}

export function BacktestsPage() {
  const query = useBacktests();
  const columns = useColumns();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/backtests/new">
            <Play className="h-4 w-4" aria-hidden="true" />
            Run backtest
          </Link>
        </Button>
      </div>
      <DataTable
        caption="Backtests"
        columns={columns}
        data={query.data ?? []}
        getRowId={(r) => r.id}
        initialSort={[{ id: "createdAt", desc: true }]}
        loading={query.isPending}
        error={
          query.isError ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : undefined
        }
        emptyState={
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title="No backtests yet"
            description="Runs you start will appear here."
          />
        }
      />
    </div>
  );
}
