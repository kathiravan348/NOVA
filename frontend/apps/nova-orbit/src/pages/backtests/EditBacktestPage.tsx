import { useParams } from "react-router";
import { EmptyState, Skeleton } from "@nova/ui-core";
import { useBacktest, useInstruments, useStrategies } from "@nova/services";
import { QueryError, QueryState } from "../../components/QueryState";
import { BacktestFormView } from "./NewBacktestPage";

/** Edit: the backtest form pre-filled from a run; saving queues its next version (D60). */
export function EditBacktestPage() {
  const { id = "" } = useParams();
  const run = useBacktest(id);
  const strategies = useStrategies();
  const instruments = useInstruments();
  if (strategies.isPending || instruments.isPending) {
    return <Skeleton className="h-96 w-full max-w-3xl" />;
  }
  if (strategies.isError) {
    return <QueryError error={strategies.error} onRetry={() => void strategies.refetch()} />;
  }
  return (
    <QueryState query={run} back={{ to: "/backtests", label: "Back to backtests" }}>
      {(data) =>
        data.status === "queued" || data.status === "running" ? (
          <EmptyState
            title="This backtest is still running"
            description="Edit it once this version has finished."
          />
        ) : (
          <BacktestFormView strategies={strategies.data} editing={data} />
        )
      }
    </QueryState>
  );
}
