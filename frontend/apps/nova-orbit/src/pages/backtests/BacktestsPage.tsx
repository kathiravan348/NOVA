import { usePageState } from "@nova/services";
import { useState } from "react";
import { Link } from "react-router";
import { BarChart3, Play } from "lucide-react";
import { Button, DataTable, EmptyState, Pager } from "@nova/ui-core";
import { useBacktests } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { DeleteSelectedButton } from "./DeleteBacktestButton";
import { useRunColumns } from "./runColumns";

export function BacktestsPage() {
  const paging = usePageState();
  const query = useBacktests({}, paging);
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
      <Pager
        page={paging.page}
        pageSize={paging.pageSize}
        total={query.total}
        onPageChange={paging.setPage}
        onPageSizeChange={paging.setPageSize}
        loading={query.isFetching}
      />
    </div>
  );
}
