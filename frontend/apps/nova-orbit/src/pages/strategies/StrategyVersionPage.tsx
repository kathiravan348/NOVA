import { Link, useParams } from "react-router";
import { ArrowLeft, Play } from "lucide-react";
import type { Strategy, VersionStats } from "@nova/contracts";
import { Button, Card, EmptyState } from "@nova/ui-core";
import { formatPercent } from "@nova/ui-trading";
import { useStrategy, useStrategyStats } from "@nova/services";
import { QueryState } from "../../components/QueryState";
import { formatIstDateTime } from "../../lib/format";
import { StrategySpecCard } from "./StrategySpecCard";

/** "3 completed backtests · best return +5.20%" with the best run linked (D60). */
export function VersionRecord({ stats }: { stats: VersionStats | undefined }) {
  if (!stats || stats.runsCompleted === 0 || stats.bestReturnPercent === null) {
    return <span className="text-text-muted">No completed backtests</span>;
  }
  const runs = `${stats.runsCompleted} completed backtest${stats.runsCompleted === 1 ? "" : "s"}`;
  return (
    <span>
      {runs} · best return{" "}
      <Link
        to={`/backtests/${stats.bestRunId}`}
        className="font-mono text-action-text hover:underline"
      >
        {formatPercent(stats.bestReturnPercent, { decimals: 2, signed: true })}
      </Link>
    </span>
  );
}

/** The record of each version of a strategy, by version number. */
export function useVersionStats(strategyId: string): Map<number, VersionStats> {
  const stats = useStrategyStats();
  const row = stats.data?.find((s) => s.strategyId === strategyId);
  return new Map((row?.byVersion ?? []).map((v) => [v.version, v]));
}

function VersionView({ strategy, version }: { strategy: Strategy; version: number }) {
  const found = strategy.versions.find((v) => v.version === version);
  const record = useVersionStats(strategy.id).get(version);
  const back = (
    <Button asChild variant="secondary" size="sm">
      <Link to={`/strategies/${strategy.id}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to {strategy.name}
      </Link>
    </Button>
  );
  if (!found) {
    return (
      <EmptyState
        title="Not found"
        description={`${strategy.name} has no version ${version}.`}
        action={back}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-page-title text-text-primary">
              {strategy.name} <span className="text-text-muted">· v{found.version}</span>
            </h2>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {back}
              {strategy.status !== "archived" && (
                <Button asChild size="sm">
                  <Link to={`/backtests/new?strategy=${strategy.id}&version=${found.version}`}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Run backtest
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <p className="text-body text-text-secondary">{found.note}</p>
          <p className="text-body-sm text-text-muted">
            Saved {formatIstDateTime(found.createdAt)}
            {found.version === strategy.latestVersion ? " · latest version" : ""}
          </p>
          <p className="text-body-sm text-text-primary">
            <VersionRecord stats={record} />
          </p>
        </div>
      </Card>
      <StrategySpecCard spec={found.spec} version={found.version} />
    </div>
  );
}

/** One strategy version's full rules and its backtest record (D60). */
export function StrategyVersionPage() {
  const { id = "", version = "" } = useParams();
  const query = useStrategy(id);
  return (
    <QueryState query={query} back={{ to: "/strategies", label: "Back to strategies" }}>
      {(strategy) => <VersionView strategy={strategy} version={Number(version)} />}
    </QueryState>
  );
}
