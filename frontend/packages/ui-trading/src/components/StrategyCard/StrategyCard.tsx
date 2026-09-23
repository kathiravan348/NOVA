import * as React from "react";
import type { StrategyStats } from "@nova/contracts";
import { Card, Skeleton, cn } from "@nova/ui-core";
import { StrategyStatsList } from "./StrategyStatsList";

export interface StrategyCardProps {
  /** Strategy name, usually a link to its page. */
  title: React.ReactNode;
  /** Status badge. */
  status: React.ReactNode;
  /** Short facts shown as one line, e.g. ["Visual", "Equity intraday", "5 min", "v2"]. */
  details: string[];
  /** Already formatted, e.g. "Updated 15 Aug 2026". */
  updatedLabel: string;
  /** Backtest summary; `undefined` while loading. */
  stats?: StrategyStats;
  statsLoading?: boolean;
  lastRunLabel?: string;
  renderBestRun?: (content: React.ReactNode, runId: string) => React.ReactNode;
  className?: string;
}

/** One strategy in the Orbit card grid (R1): facts, run counts and best/worst results. */
export function StrategyCard({
  title,
  status,
  details,
  updatedLabel,
  stats,
  statsLoading = false,
  lastRunLabel,
  renderBestRun,
  className,
}: StrategyCardProps): React.ReactElement {
  return (
    <Card title={title} actions={status} className={cn("h-full", className)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-body-sm text-text-secondary">{details.join(" · ")}</p>
          <p className="text-body-sm text-text-muted">{updatedLabel}</p>
        </div>
        {statsLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : stats ? (
          <StrategyStatsList
            stats={stats}
            lastRunLabel={lastRunLabel}
            renderBestRun={renderBestRun}
          />
        ) : (
          <p className="text-body-sm text-text-muted">Backtest stats unavailable.</p>
        )}
      </div>
    </Card>
  );
}
