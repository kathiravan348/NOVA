import { useSearchParams } from "react-router";
import { GitCompare } from "lucide-react";
import { Card, EmptyState, LoadMore, Skeleton } from "@nova/ui-core";
import { EquityCurve } from "@nova/ui-trading";
import { useBacktestResults, useBacktests } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { summarizeUniverse } from "../../lib/strategyText";
import { parseRunIds, toSearch } from "./compareMetrics";
import { MetricsComparison, type ComparedRun } from "./MetricsComparison";
import { RunPicker } from "./RunPicker";

export function ComparePage() {
  const [params, setParams] = useSearchParams();
  const runsQuery = useBacktests();
  const requested = parseRunIds(params.get("runs"));

  const completed = (runsQuery.data ?? []).filter((r) => r.status === "completed");
  const selected = requested.filter((id) => completed.some((r) => r.id === id));
  const ignored = runsQuery.isSuccess ? requested.filter((id) => !selected.includes(id)) : [];
  const results = useBacktestResults(selected);

  const setSelected = (ids: string[]) =>
    setParams(ids.length > 0 ? { runs: toSearch(ids) } : {}, { replace: true });

  if (runsQuery.isPending) return <Skeleton className="h-64 w-full" />;
  if (runsQuery.isError) {
    return <QueryError error={runsQuery.error} onRetry={() => void runsQuery.refetch()} />;
  }

  const compared: ComparedRun[] = selected.flatMap((id, i) => {
    const data = results[i]?.data;
    const run = completed.find((r) => r.id === id);
    return data && run ? [{ id, name: run.name, metrics: data.metrics }] : [];
  });
  const loadingResults = results.some((q) => q.isPending);
  const failed = results.find((q) => q.isError);

  return (
    <div className="flex flex-col gap-6">
      <RunPicker runs={completed} selected={selected} onChange={setSelected} />
      <LoadMore
        hasMore={runsQuery.hasNextPage}
        loading={runsQuery.isFetchingNextPage}
        onLoadMore={() => void runsQuery.fetchNextPage()}
        label="Load more runs"
      />
      {ignored.length > 0 && (
        <p className="text-body-sm text-text-muted">
          Skipped (not a completed run): {ignored.join(", ")}
        </p>
      )}
      {selected.length < 2 ? (
        <EmptyState
          icon={<GitCompare className="h-6 w-6" />}
          title="Choose at least two runs"
          description="Pick runs above to compare their metrics and equity curves."
        />
      ) : failed ? (
        <QueryError error={failed.error} onRetry={() => void failed.refetch()} />
      ) : loadingResults ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <MetricsComparison runs={compared} />
          <div className="grid gap-6 lg:grid-cols-2">
            {compared.map((run, i) => {
              const data = results[i]!.data!;
              const source = completed.find((r) => r.id === run.id)!;
              return (
                <Card
                  key={run.id}
                  title={run.name}
                  actions={
                    <span className="text-body-sm text-text-muted">
                      {summarizeUniverse(source.universe)}
                    </span>
                  }
                >
                  <EquityCurve
                    points={data.equityCurve}
                    initialCapitalPaise={source.initialCapitalPaise}
                    height={220}
                    ariaLabel={`Equity curve for ${run.name}`}
                  />
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
