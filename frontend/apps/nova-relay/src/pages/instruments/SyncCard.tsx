import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { MAX_DOWNLOAD_SYMBOLS, type DataJobPlanRequest } from "@nova/contracts";
import { Button, Card, Skeleton, StatusBadge, useToast } from "@nova/ui-core";
import { Meter, formatPercent } from "@nova/ui-trading";
import {
  getDataMode,
  useLatestSync,
  useRefreshAfterSync,
  useSyncInstruments,
  useCoverage,
} from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { DATA_START_DAY, formatIstDateTime, todayIst } from "../../lib/format";
import { jobStatusLabel, jobStatusTone } from "../../lib/labels";

/** Sync with Kite (D56): the latest sync's state or result, and the button to queue one. */
export function SyncCard() {
  const toast = useToast();
  const navigate = useNavigate();
  const latest = useLatestSync();
  const sync = useSyncInstruments();
  const refreshAfterSync = useRefreshAfterSync();
  const [failed, setFailed] = useState<string | null>(null);
  const job = latest.data ?? null;
  // Stored history is only read when the latest sync found stocks that may need it.
  const listed = job?.status === "completed" && job.syncResult;
  const check = Boolean(
    listed && (listed.newSymbols.length > 0 || listed.newIndexMembers.length > 0),
  );
  const daily = useCoverage({ timeframe: "1d", from: DATA_START_DAY, to: todayIst() }, check);
  const minute = useCoverage({ timeframe: "1m", from: DATA_START_DAY, to: todayIst() }, check);
  const history = new Set(
    [...(daily.data?.rows ?? []), ...(minute.data?.rows ?? [])]
      .filter((r) => r.firstDay !== null)
      .map((r) => r.symbol),
  );
  const required =
    job?.status === "completed" && job.syncResult
      ? [
          ...new Set([
            ...job.syncResult.newSymbols,
            ...job.syncResult.newIndexMembers.map((m) => m.symbol),
          ]),
        ]
          .filter((symbol) => !history.has(symbol))
          .sort()
      : [];
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

  const download = () => {
    const syncPlans: DataJobPlanRequest[] = [];
    for (const timeframe of ["1d", "1m"] as const) {
      for (let offset = 0; offset < required.length; offset += MAX_DOWNLOAD_SYMBOLS) {
        syncPlans.push({
          symbols: required.slice(offset, offset + MAX_DOWNLOAD_SYMBOLS),
          timeframe,
          from: DATA_START_DAY,
          to: todayIst(),
          mode: "skip_existing",
        });
      }
    }
    void navigate("/data-jobs/new", { state: { syncPlans } });
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
        {required.length > 0 && (
          <Card title="Price history needed">
            <div role="status" className="flex flex-col gap-3 text-body-sm text-warning-text">
              <p>
                {required.length} {required.length === 1 ? "stock has" : "stocks have"} no price
                history: {required.slice(0, 5).join(", ")}
                {required.length > 5 ? ` and ${required.length - 5} more` : ""}.
              </p>
              <p>
                Review daily and 1-minute prices from 1 Jan 2020. Each download starts only when you
                press Start.
              </p>
              {(daily.isError || minute.isError) && (
                <p>Could not refresh stored history. Retry before downloading.</p>
              )}
              <Button
                variant="secondary"
                disabled={!daily.data || !minute.data || daily.isError || minute.isError}
                onClick={download}
              >
                Download required data
              </Button>
              {(daily.isError || minute.isError) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void daily.refetch();
                    void minute.refetch();
                  }}
                >
                  Retry history check
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </Card>
  );
}
