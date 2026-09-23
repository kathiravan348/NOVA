import { useState } from "react";
import { Link, useParams } from "react-router";
import { AlertTriangle, GitCompare, Hourglass } from "lucide-react";
import type { BacktestRun } from "@nova/contracts";
import { Button, Card, DescriptionList, EmptyState, Skeleton, StatusBadge } from "@nova/ui-core";
import { EquityCurve, formatInr } from "@nova/ui-trading";
import { useBacktest, useBacktestResult, useBacktestTrades, useStrategy } from "@nova/services";
import { QueryError, QueryState } from "../../components/QueryState";
import { formatIstDateTime, formatPeriod, runStatusLabel, runStatusTone } from "../../lib/format";
import { describeUniverse } from "../../lib/strategyText";
import { MetricsGrid } from "./MetricsGrid";
import { SymbolBreakdown } from "./SymbolBreakdown";
import { TradesTable } from "./TradesTable";

function RunHeader({ run }: { run: BacktestRun }) {
  const strategy = useStrategy(run.strategyId);
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-page-title text-text-primary">{run.name}</h2>
          <StatusBadge tone={runStatusTone[run.status]} label={runStatusLabel[run.status]} />
          {run.status === "completed" && (
            <Button asChild variant="secondary" size="sm" className="sm:ml-auto">
              <Link to={`/compare?runs=${run.id}`}>
                <GitCompare className="h-4 w-4" aria-hidden="true" />
                Compare
              </Link>
            </Button>
          )}
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

function CompletedRun({ run }: { run: BacktestRun }) {
  const result = useBacktestResult(run.id);
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
          <MetricsGrid metrics={result.data.metrics} />
          <Card title="Equity curve">
            <EquityCurve
              points={result.data.equityCurve}
              initialCapitalPaise={run.initialCapitalPaise}
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
      </section>
    </>
  );
}

function RunBody({ run }: { run: BacktestRun }) {
  if (run.status === "completed") return <CompletedRun run={run} />;
  if (run.status === "failed") {
    return (
      <EmptyState
        tone="error"
        icon={<AlertTriangle className="h-6 w-6" />}
        title="This run failed"
        description={run.error ?? "No error message."}
      />
    );
  }
  return (
    <EmptyState
      icon={<Hourglass className="h-6 w-6" />}
      title="This run hasn't finished"
      description={`Status: ${runStatusLabel[run.status]}. Results appear when it completes.`}
    />
  );
}

export function BacktestResultPage() {
  const { id = "" } = useParams();
  const query = useBacktest(id);
  return (
    <QueryState query={query} back={{ to: "/backtests", label: "Back to backtests" }}>
      {(run) => (
        <div className="flex flex-col gap-6">
          <RunHeader run={run} />
          <RunBody run={run} />
        </div>
      )}
    </QueryState>
  );
}
