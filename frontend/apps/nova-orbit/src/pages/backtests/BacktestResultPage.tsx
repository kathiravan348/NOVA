import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AlertTriangle, GitCompare, Pencil } from "lucide-react";
import type { BacktestRun, Segment } from "@nova/contracts";
import {
  Button,
  Card,
  DescriptionList,
  EmptyState,
  Skeleton,
  StatusBadge,
  LoadMore,
} from "@nova/ui-core";
import { EquityCurve, formatInr } from "@nova/ui-trading";
import {
  useBacktest,
  useBacktestResult,
  useBacktestTrades,
  useBacktestVersions,
  useStrategy,
} from "@nova/services";
import { QueryError, QueryState } from "../../components/QueryState";
import { formatIstDateTime, formatPeriod, runStatusLabel, runStatusTone } from "../../lib/format";
import { describeUniverse } from "../../lib/strategyText";
import { DeleteBacktestButton } from "./DeleteBacktestButton";
import { MetricsGrid } from "./MetricsGrid";
import { RunProgress } from "./RunProgress";
import { progressLine } from "./progressText";
import { SymbolBreakdown } from "./SymbolBreakdown";
import { TradesTable } from "./TradesTable";
import { VersionsTable } from "./VersionsTable";
import { YearsTable } from "./YearsTable";

function RunHeader({ run }: { run: BacktestRun }) {
  const strategy = useStrategy(run.strategyId);
  const navigate = useNavigate();
  const active = run.status === "queued" || run.status === "running";
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-page-title text-text-primary">
            {run.name}
            {run.version > 1 && <span className="text-text-muted"> · v{run.version}</span>}
          </h2>
          <StatusBadge tone={runStatusTone[run.status]} label={runStatusLabel[run.status]} />
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {run.status === "completed" && run.reportKept && (
              <Button asChild variant="secondary" size="sm">
                <Link to={`/compare?runs=${run.id}`}>
                  <GitCompare className="h-4 w-4" aria-hidden="true" />
                  Compare
                </Link>
              </Button>
            )}
            {!active && (
              <Button asChild variant="secondary" size="sm">
                <Link to={`/backtests/${run.id}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Link>
              </Button>
            )}
            {run.status !== "running" && (
              <DeleteBacktestButton
                runId={run.id}
                name={run.name}
                onDeleted={() => navigate("/backtests")}
              />
            )}
          </div>
        </div>
        <DescriptionList
          columns={2}
          items={[
            {
              label: "Strategy",
              value: (
                <Link
                  to={`/strategies/${run.strategyId}`}
                  className="text-action-text hover:underline"
                >
                  {strategy.data?.name ?? run.strategyId} · v{run.strategyVersion}
                </Link>
              ),
            },
            { label: "Symbols", value: describeUniverse(run.universe) },
            { label: "Period", value: formatPeriod(run.from, run.to) },
            {
              label: "Initial capital",
              value: formatInr(run.initialCapitalPaise, { decimals: 0 }),
              numeric: true,
            },
            { label: "Benchmark", value: run.benchmark ?? "None" },
            { label: "Created", value: formatIstDateTime(run.createdAt) },
            {
              label: "Finished",
              value: run.finishedAt ? formatIstDateTime(run.finishedAt) : "—",
            },
          ]}
        />
      </div>
    </Card>
  );
}

/** The segment of the run's strategy version (intraday runs have no tax estimate, D62). */
function useRunSegment(run: BacktestRun): Segment | undefined {
  const strategy = useStrategy(run.strategyId);
  return strategy.data?.versions.find((v) => v.version === run.strategyVersion)?.spec.segment;
}

function CompletedRun({ run }: { run: BacktestRun }) {
  const result = useBacktestResult(run.id);
  const segment = useRunSegment(run);
  const trades = useBacktestTrades(run.id);
  const [symbol, setSymbol] = useState("");
  const showTrades = (s: string) => {
    setSymbol(s);
    document.getElementById("trades")?.scrollIntoView?.({ behavior: "smooth" });
  };
  return (
    <>
      {result.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : result.isError ? (
        <QueryError error={result.error} onRetry={() => void result.refetch()} />
      ) : (
        <>
          <MetricsGrid metrics={result.data.metrics} benchmark={run.benchmark} segment={segment} />
          <YearsTable years={result.data.years} />
          <Card title="Equity curve">
            <EquityCurve
              points={result.data.equityCurve}
              initialCapitalPaise={run.initialCapitalPaise}
              benchmarkLabel={run.benchmark ?? undefined}
              ariaLabel={`Equity curve for ${run.name}`}
            />
          </Card>
          <section className="flex flex-col gap-3">
            <h3 className="text-section-title text-text-primary">Results by symbol</h3>
            <SymbolBreakdown rows={result.data.bySymbol} onShowTrades={showTrades} />
          </section>
        </>
      )}
      <section id="trades" className="flex flex-col gap-3">
        <h3 className="text-section-title text-text-primary">Trades</h3>
        <TradesTable
          trades={trades.data ?? []}
          symbol={symbol}
          onSymbolChange={setSymbol}
          loading={trades.isPending}
          error={
            trades.isError ? (
              <QueryError error={trades.error} onRetry={() => void trades.refetch()} />
            ) : undefined
          }
        />
        <LoadMore
          hasMore={trades.hasNextPage}
          loading={trades.isFetchingNextPage}
          onLoadMore={() => void trades.fetchNextPage()}
          label="Load more trades"
        />
      </section>
    </>
  );
}

/** An older version keeps only its metrics (D60). */
function SummaryOnly({ run, newestId }: { run: BacktestRun; newestId?: string }) {
  const result = useBacktestResult(run.id);
  const segment = useRunSegment(run);
  return (
    <>
      <p className="text-body text-text-secondary">
        Older version: only the summary is kept. The newest version has the full report.{" "}
        {newestId && newestId !== run.id && (
          <Link to={`/backtests/${newestId}`} className="text-action-text hover:underline">
            Open the newest version
          </Link>
        )}
      </p>
      {result.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : result.isError ? (
        <QueryError error={result.error} onRetry={() => void result.refetch()} />
      ) : (
        <>
          <MetricsGrid metrics={result.data.metrics} benchmark={run.benchmark} segment={segment} />
          <YearsTable years={result.data.years} />
        </>
      )}
    </>
  );
}

function RunBody({ run, newestId }: { run: BacktestRun; newestId?: string }) {
  if (run.status === "completed" && !run.reportKept) {
    return <SummaryOnly run={run} newestId={newestId} />;
  }
  if (run.status === "completed") return <CompletedRun run={run} />;
  if (run.status === "failed") {
    const stopped = run.progress
      ? `Stopped while: ${progressLine(run.progress)} (${run.progress.percent}%)`
      : null;
    return (
      <EmptyState
        tone="error"
        icon={<AlertTriangle className="h-6 w-6" />}
        title="This run failed"
        description={
          <>
            {run.error ?? "No error message."}
            {stopped && <span className="mt-2 block text-text-muted">{stopped}</span>}
          </>
        }
      />
    );
  }
  return <RunProgress run={run} />;
}

const SKIPPED_SHOWN = 10;

function skippedNote(symbols: string[]): string {
  const count = `${symbols.length} ${symbols.length === 1 ? "stock" : "stocks"}`;
  const rest = symbols.length - SKIPPED_SHOWN;
  const more = rest > 0 ? ` and ${rest} more` : "";
  return `Skipped ${count} with no prices in this period: ${symbols.slice(0, SKIPPED_SHOWN).join(", ")}${more}`;
}

export function BacktestResultPage() {
  const { id = "" } = useParams();
  const query = useBacktest(id);
  const versions = useBacktestVersions(id);
  const history = versions.data ?? [];
  return (
    <QueryState query={query} back={{ to: "/backtests", label: "Back to backtests" }}>
      {(run) => (
        <div className="flex flex-col gap-6">
          <RunHeader run={run} />
          {run.skippedSymbols.length > 0 && <Card>{skippedNote(run.skippedSymbols)}</Card>}
          {history.length > 1 && <VersionsTable versions={history} currentId={run.id} />}
          <RunBody run={run} newestId={history[0]?.runId} />
        </div>
      )}
    </QueryState>
  );
}
