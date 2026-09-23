import { useState } from "react";
import { Link } from "react-router";
import { Plus, Workflow } from "lucide-react";
import type { Strategy, StrategyStats, StrategyStatus } from "@nova/contracts";
import { Button, EmptyState, Select, Skeleton, StatusBadge } from "@nova/ui-core";
import { StrategyCard } from "@nova/ui-trading";
import { useStrategies, useStrategyStats } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import {
  formatIstDate,
  segmentLabel,
  strategyStatusLabel,
  strategyStatusTone,
  timeframeLabel,
} from "../../lib/format";

export type SortKey = "updated" | "best" | "runs";
type StatusFilter = StrategyStatus | "all";

const latestSpec = (s: Strategy) => s.versions.find((v) => v.version === s.latestVersion)!.spec;

/** Ties (and "updated") go newest first; strategies without a completed run sort last by return. */
export function sortStrategies(
  list: Strategy[],
  statsById: Map<string, StrategyStats>,
  sort: SortKey,
): Strategy[] {
  const best = (s: Strategy) => statsById.get(s.id)?.bestReturnPercent ?? -Infinity;
  const runs = (s: Strategy) => statsById.get(s.id)?.runsTotal ?? 0;
  return [...list].sort((a, b) => {
    if (sort === "best" && best(a) !== best(b)) return best(b) > best(a) ? 1 : -1;
    if (sort === "runs" && runs(a) !== runs(b)) return runs(b) - runs(a);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function StrategyGrid({ strategies }: { strategies: Strategy[] }) {
  const statsQuery = useStrategyStats();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const statsById = new Map((statsQuery.data ?? []).map((s) => [s.strategyId, s]));
  const shown = sortStrategies(
    strategies.filter((s) => status === "all" || s.status === status),
    statsById,
    sort,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:w-2/3">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          options={[
            { value: "all", label: "All" },
            ...(["active", "draft", "archived"] as const).map((v) => ({
              value: v,
              label: strategyStatusLabel[v],
            })),
          ]}
        />
        <Select
          label="Sort by"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          options={[
            { value: "updated", label: "Recently updated" },
            { value: "best", label: "Best return" },
            { value: "runs", label: "Most runs" },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-6 w-6" />}
          title="No strategies match"
          description="Try another status."
        />
      ) : (
        <ul aria-label="Strategies" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => {
            const spec = latestSpec(s);
            const stats = statsById.get(s.id);
            return (
              <li key={s.id}>
                <StrategyCard
                  title={
                    <Link to={`/strategies/${s.id}`} className="text-action-text hover:underline">
                      {s.name}
                    </Link>
                  }
                  status={
                    <StatusBadge
                      tone={strategyStatusTone[s.status]}
                      label={strategyStatusLabel[s.status]}
                    />
                  }
                  details={[
                    spec.mode === "visual" ? "Visual" : "Python",
                    segmentLabel[spec.segment],
                    timeframeLabel[spec.timeframe],
                    `v${s.latestVersion}`,
                  ]}
                  updatedLabel={`Updated ${formatIstDate(s.updatedAt)}`}
                  stats={stats}
                  statsLoading={statsQuery.isPending}
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
    </div>
  );
}

export function StrategiesPage() {
  const query = useStrategies();
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
      {query.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-6 w-6" />}
          title="No strategies yet"
          description="Strategies you build will appear here."
        />
      ) : (
        <StrategyGrid strategies={query.data} />
      )}
    </div>
  );
}
