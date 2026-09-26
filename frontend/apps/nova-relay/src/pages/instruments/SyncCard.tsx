import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button, Card, Skeleton, StatusBadge, useToast } from "@nova/ui-core";
import { Meter, formatPercent } from "@nova/ui-trading";
import {
  getDataMode,
  useLatestSync,
  useRefreshAfterSync,
  useSyncInstruments,
} from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatIstDateTime } from "../../lib/format";
import { jobStatusLabel, jobStatusTone } from "../../lib/labels";

/** Sync with Kite (D56): the latest sync's state or result, and the button to queue one. */
export function SyncCard() {
  const toast = useToast();
  const latest = useLatestSync();
  const sync = useSyncInstruments();
  const refreshAfterSync = useRefreshAfterSync();
  const [failed, setFailed] = useState<string | null>(null);
  const job = latest.data ?? null;
  const active = job !== null && (job.status === "queued" || job.status === "running");

  // When a sync finishes, the stock list, indices and instruments have changed.
  const seenStatus = useRef(job?.status);
  useEffect(() => {
    const before = seenStatus.current;
    seenStatus.current = job?.status;
    if (job?.status === "completed" && (before === "queued" || before === "running")) {
      void refreshAfterSync();
    }
  }, [job?.status, refreshAfterSync]);

  if (latest.isPending) return <Skeleton className="h-32 w-full" />;
  if (latest.isError) {
    return <QueryError error={latest.error} onRetry={() => void latest.refetch()} />;
  }

  const run = async () => {
    setFailed(null);
    try {
      await sync.mutateAsync();
      const demo = getDataMode() === "mock" ? " (demo)" : "";
      toast.show({ title: `Sync with Kite queued${demo}`, tone: "success" });
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not sync with Kite");
    }
  };

  return (
    <Card
      title="Sync with Kite"
      actions={
        <Button size="sm" disabled={active || sync.isPending} onClick={() => void run()}>
          {active ? "Syncing…" : "Sync with Kite"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-text-muted">
          Adds every NSE stock and refreshes index members. Syncs automatically every weekday from
          08:45 once Kite is logged in.
        </p>
        {job === null ? (
          <p className="text-body-sm text-text-secondary">Not synced yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3 text-body-sm text-text-secondary">
              <StatusBadge tone={jobStatusTone[job.status]} label={jobStatusLabel[job.status]} />
              <span>
                {job.status === "completed" && job.finishedAt
                  ? `Last synced ${formatIstDateTime(job.finishedAt)}`
                  : `Started ${formatIstDateTime(job.createdAt)}`}
              </span>
              <Link
                to={`/data-jobs/${job.id}`}
                className="font-medium text-action-text hover:underline"
              >
                View job
              </Link>
            </div>
            {active && (
              <Meter
                label="Sync progress"
                value={job.progressPercent}
                max={100}
                valueText={formatPercent(job.progressPercent, { decimals: 0 })}
                warnAt={2}
                dangerAt={2}
              />
            )}
            {job.summary && <p className="text-body-sm text-text-primary">{job.summary}</p>}
            {job.status === "failed" && job.error && (
              <p role="alert" className="text-body-sm text-loss">
                {job.error}
              </p>
            )}
          </div>
        )}
        {failed && (
          <p role="alert" className="text-body-sm text-loss">
            {failed}
          </p>
        )}
      </div>
    </Card>
  );
}
