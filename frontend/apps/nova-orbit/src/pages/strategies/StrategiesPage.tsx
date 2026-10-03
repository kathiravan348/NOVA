import { useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Plus, Workflow } from "lucide-react";
import { Button, EmptyState, Skeleton, StatusBadge } from "@nova/ui-core";
import { StrategyCard } from "@nova/ui-trading";
import { useStrategies, useStrategyStats } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import {
  formatIstDate,
  segmentLabel,
  strategyStatusTone,
  strategyStatusLabel,
  timeframeLabel,
} from "../../lib/format";
import { modeLabel } from "../../lib/strategyText";
// Explicit extension avoids the helper/component filename collision on Windows.
import { StrategyFilters } from "./StrategyFilters.jsx";
import {
  EMPTY_FILTERS,
  filterStrategies,
  fromQuery,
  sortStrategies,
  toQuery,
  type StrategyFilterValues,
} from "./strategyFilters";

export function StrategiesPage() {
  const [params, setParams] = useSearchParams();
  const queryString = params.toString();
  const values = useMemo(() => fromQuery(new URLSearchParams(queryString)), [queryString]);
  const change = useCallback((next: StrategyFilterValues) => setParams(toQuery(next)), [setParams]);
  const query = useStrategies();
  const statsQuery = useStrategyStats({
    dataSource: values.dataSource === "all" ? undefined : values.dataSource,
  });
  const statsById = new Map((statsQuery.data ?? []).map((stats) => [stats.strategyId, stats]));
  const strategies = query.data ?? [];
  const shown = sortStrategies(
    filterStrategies(strategies, statsById, values),
    statsById,
    values.sort,
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/strategies/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New strategy
          </Link>
        </Button>
      </div>
      <StrategyFilters values={values} onChange={change} />
      {query.isPending || statsQuery.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading strategies">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : statsQuery.isError ? (
        <QueryError error={statsQuery.error} onRetry={() => void statsQuery.refetch()} />
      ) : strategies.length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-6 w-6" />}
          title="No strategies yet"
          description="Strategies you build will appear here."
        />
      ) : (
        <>
          <p className="text-body-sm text-text-muted">
            {shown.length} of {strategies.length} strategies
          </p>
          {shown.length === 0 ? (
            <EmptyState
              icon={<Workflow className="h-6 w-6" />}
              title="No strategies match"
              description="Try another filter."
              action={
                <Button variant="secondary" onClick={() => change(EMPTY_FILTERS)}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ul aria-label="Strategies" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((strategy) => {
                const spec = strategy.versions.find(
                  (version) => version.version === strategy.latestVersion,
                )!.spec;
                const stats = statsById.get(strategy.id);
                return (
                  <li key={strategy.id}>
                    <StrategyCard
                      title={
                        <Link
                          to={`/strategies/${strategy.id}`}
                          className="text-action-text hover:underline"
                        >
                          {strategy.name}
                        </Link>
                      }
                      status={
                        <StatusBadge
                          tone={strategyStatusTone[strategy.status]}
                          label={strategyStatusLabel[strategy.status]}
                        />
                      }
                      details={[
                        modeLabel(spec.mode),
                        segmentLabel[spec.segment],
                        timeframeLabel[spec.timeframe],
                        `v${strategy.latestVersion}`,
                      ]}
                      updatedLabel={`Updated ${formatIstDate(strategy.updatedAt)}`}
                      stats={stats}
                      lastRunLabel={stats?.lastRunAt ? formatIstDate(stats.lastRunAt) : undefined}
                      renderBestRun={(content, runId) => (
                        <Link to={`/backtests/${runId}`} className="hover:underline">
                          {content}
                        </Link>
                      )}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
