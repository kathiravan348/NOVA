import * as React from "react";
import type { StrategyStats } from "@nova/contracts";
import { cn } from "@nova/ui-core";
import { formatPercent, formatQuantity } from "../../format/money";
import { PnLText } from "../PnLText/PnLText";

export interface StrategyStatsListProps {
  stats: StrategyStats;
  /** Last run time, already formatted by the app (e.g. IST). */
  lastRunLabel?: string;
  /** Wraps the best net P&L, e.g. in a link to that run. */
  renderBestRun?: (content: React.ReactNode, runId: string) => React.ReactNode;
  className?: string;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-label text-text-muted">{label}</dt>
      <dd className="font-mono text-number tabular-nums text-text-primary">{children}</dd>
    </div>
  );
}

const winPct = (n: number) => formatPercent(n, { decimals: Number.isInteger(n) ? 0 : 1 });

const signedTone = (n: number) => (n > 0 ? "text-profit" : n < 0 ? "text-loss" : undefined);

/** Backtest summary for one strategy (D26): run counts, then results when a run has completed. */
export function StrategyStatsList({
  stats,
  lastRunLabel,
  renderBestRun,
  className,
}: StrategyStatsListProps): React.ReactElement {
  const s = stats;
  const winRate =
    s.winRateMinPercent === null || s.winRateMaxPercent === null
      ? null
      : s.winRateMinPercent === s.winRateMaxPercent
        ? winPct(s.winRateMinPercent)
        : `${winPct(s.winRateMinPercent)}–${winPct(s.winRateMaxPercent)}`;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <dl className="grid grid-cols-4 gap-3">
        <Stat label="Runs">{formatQuantity(s.runsTotal)}</Stat>
        <Stat label="Done">{formatQuantity(s.runsCompleted)}</Stat>
        <Stat label="Failed">{formatQuantity(s.runsFailed)}</Stat>
        <Stat label="Active">{formatQuantity(s.runsInProgress)}</Stat>
      </dl>
      {s.bestNetPnl === null ||
      s.bestReturnPercent === null ||
      s.worstReturnPercent === null ||
      s.worstDrawdownPercent === null ? (
        <p className="text-body-sm text-text-muted">No completed runs yet.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3">
          <Stat label="Best return">
            <span className={signedTone(s.bestReturnPercent)}>
              {formatPercent(s.bestReturnPercent, { signed: true })}
            </span>
          </Stat>
          <Stat label="Worst return">
            <span className={signedTone(s.worstReturnPercent)}>
              {formatPercent(s.worstReturnPercent, { signed: true })}
            </span>
          </Stat>
          <Stat label="Win rate">{winRate}</Stat>
          <Stat label="Worst drawdown">
            <span className={signedTone(s.worstDrawdownPercent)}>
              {formatPercent(s.worstDrawdownPercent, { signed: true })}
            </span>
          </Stat>
          <Stat label="Best net P&L">
            {renderBestRun ? (
              renderBestRun(<PnLText paise={s.bestNetPnl.netPnlPaise} />, s.bestNetPnl.runId)
            ) : (
              <PnLText paise={s.bestNetPnl.netPnlPaise} />
            )}
          </Stat>
          {lastRunLabel && <Stat label="Last run">{lastRunLabel}</Stat>}
        </dl>
      )}
      {s.bestNetPnl === null && lastRunLabel && (
        <p className="text-body-sm text-text-muted">Last run {lastRunLabel}</p>
      )}
    </div>
  );
}
