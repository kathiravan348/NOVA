import { useState } from "react";
import { useSearchParams } from "react-router";
import { GitCompare } from "lucide-react";
import { Button, Card, EmptyState, Skeleton } from "@nova/ui-core";
import { EquityCurve } from "@nova/ui-trading";
import { useBacktestResults, useBacktestRuns } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { summarizeUniverse } from "../../lib/strategyText";
import { parseRunIds, toSearch } from "./compareMetrics";
import { MetricsComparison, type ComparedRun } from "./MetricsComparison";
import { RunPickerDialog } from "./RunPickerDialog";
import { SelectedRuns } from "./SelectedRuns";

export function ComparePage() {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const requested = parseRunIds(params.get("runs"));
  const requestedRuns = useBacktestRuns(requested);
  const completed = requestedRuns.flatMap((query) =>
    query.data?.status === "completed" ? [query.data] : [],
  );
  const selected = requested.filter((id) => completed.some((r) => r.id === id));
  const ignored = requestedRuns.every((query) => !query.isPending)
    ? requested.filter((id) => !selected.includes(id))
    : [];
  const results = useBacktestResults(selected);

  const setSelected = (ids: string[]) =>
    setParams(ids.length > 0 ? { runs: toSearch(ids) } : {}, { replace: true });

  if (requestedRuns.some((query) => query.isPending)) return <Skeleton className="h-64 w-full" />;

  const compared: ComparedRun[] = selected.flatMap((id, i) => {
    const data = results[i]?.data;
    const run = completed.find((r) => r.id === id);
    return data && run ? [{ id, name: run.name, metrics: data.metrics }] : [];
  });
  const loadingResults = results.some((q) => q.isPending);
  const failed = results.find((q) => q.isError);

  return (
    <div className="flex flex-col gap-6">
      <SelectedRuns
        runs={completed}
        onRemove={(id) => setSelected(selected.filter((chosen) => chosen !== id))}
        onChoose={() => setOpen(true)}
      />
      {open && (
        <RunPickerDialog open onOpenChange={setOpen} selected={selected} onApply={setSelected} />
      )}
      {ignored.length > 0 && (
        <p className="text-body-sm text-text-muted">
          Skipped (not a completed run): {ignored.join(", ")}
        </p>
      )}
      {selected.length < 2 ? (
        <EmptyState
          icon={<GitCompare className="h-6 w-6" />}
          title="Choose at least two runs"
          description="Choose two or three completed runs to compare their metrics and equity curves."
          action={<Button onClick={() => setOpen(true)}>Choose runs</Button>}
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
                  {data.equityCurve.length === 0 ? (
                    <p className="text-body-sm text-text-muted">No equity curve (older version)</p>
                  ) : (
                    <EquityCurve
                      points={data.equityCurve}
                      initialCapitalPaise={source.initialCapitalPaise}
                      benchmarkLabel={source.benchmark ?? undefined}
                      height={220}
                      ariaLabel={`Equity curve for ${run.name}`}
                    />
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
