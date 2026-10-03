import { useBacktests, usePageState, useStrategies } from "@nova/services";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { BarChart3, Play } from "lucide-react";
import { Button, DataTable, EmptyState, Pager, Tabs } from "@nova/ui-core";
import { QueryError } from "../../components/QueryState";
import { DeleteSelectedButton } from "./DeleteBacktestButton";
import { useRunColumns } from "./runColumns";
// Explicit JSX extension avoids Windows resolving runFilters.ts first.
import { RunFilters } from "./RunFilters.jsx";
import { fromParams, toParams, toQuery, type RunFilterValues } from "./runFilters";

export function BacktestsPage() {
  const [params, setParams] = useSearchParams();
  const source = params.get("source") === "recorded" ? "recorded" : "history";
  const search = params.toString();
  const values = useMemo(() => fromParams(new URLSearchParams(search)), [search]);
  const canonical = toParams(values, { source }).toString();
  useEffect(() => {
    if (search !== canonical) setParams(canonical, { replace: true });
  }, [search, canonical, setParams]);
  const paging = usePageState(canonical);
  const { setPage } = paging;
  const strategies = useStrategies();
  const query = useBacktests({ ...toQuery(values), dataSource: source }, paging);
  const columns = useRunColumns({ recorded: source === "recorded" });
  const [selected, setSelected] = useState<string[]>([]);
  const change = useCallback(
    (next: RunFilterValues, dataSource = source) => {
      setPage(1);
      setSelected([]);
      setParams(toParams(next, { source: dataSource }), { replace: true });
    },
    [source, setPage, setParams],
  );
  const list = (
    <div className="flex flex-col gap-4">
      <DataTable
        caption="Backtests"
        columns={columns}
        data={query.data ?? []}
        getRowId={(r) => r.id}
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
            title={source === "recorded" ? "No recorded-data backtests yet" : "No backtests yet"}
            description={
              source === "recorded"
                ? "No recorded-data backtests yet. Choose Recorded data when you run a backtest."
                : "Runs you start will appear here."
            }
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
      <RunFilters values={values} onChange={change} strategies={strategies.data ?? []} />
      <Tabs
        ariaLabel="Backtest data source"
        value={source}
        onValueChange={(next) => change(values, next === "recorded" ? "recorded" : "history")}
        items={[
          { value: "history", label: "History data", content: list },
          { value: "recorded", label: "Recorded data", content: list },
        ]}
      />
    </div>
  );
}
