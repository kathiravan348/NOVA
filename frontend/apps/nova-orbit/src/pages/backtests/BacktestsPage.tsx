import { Link } from "react-router";
import { BarChart3, Play } from "lucide-react";
import { Button, DataTable, EmptyState } from "@nova/ui-core";
import { useBacktests } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { useRunColumns } from "./runColumns";

export function BacktestsPage() {
  const query = useBacktests();
  const columns = useRunColumns();
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
