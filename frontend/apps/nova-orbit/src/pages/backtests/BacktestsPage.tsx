import { useState } from "react";
import { Link } from "react-router";
import { BarChart3, Play } from "lucide-react";
import { Button, DataTable, EmptyState, LoadMore } from "@nova/ui-core";
import { useBacktests } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { DeleteSelectedButton } from "./DeleteBacktestButton";
import { useRunColumns } from "./runColumns";

export function BacktestsPage() {
  const query = useBacktests();
  const columns = useRunColumns();
  const [selected, setSelected] = useState<string[]>([]);
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
        selectedIds={selected}
        onSelectedIdsChange={setSelected}
        isRowSelectable={(r) => r.status !== "running"}
        toolbar={<DeleteSelectedButton ids={selected} onDeleted={() => setSelected([])} />}
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
      <LoadMore
        hasMore={query.hasNextPage}
        loading={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </div>
  );
}
