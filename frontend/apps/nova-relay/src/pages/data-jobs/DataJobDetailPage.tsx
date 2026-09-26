import { useParams } from "react-router";
import { AlertTriangle } from "lucide-react";
import { Card, DescriptionList, EmptyState, StatusBadge } from "@nova/ui-core";
import { Meter, formatPercent, formatQuantity } from "@nova/ui-trading";
import { useDataJob } from "@nova/services";
import { QueryState } from "../../components/QueryState";
import { formatIstDateTime, formatPeriod } from "../../lib/format";
import { jobStatusLabel, jobStatusTone, jobTypeLabel, segmentLabel } from "../../lib/labels";
import { CancelJobButton } from "./CancelJobButton";
import { PauseResumeButton } from "./PauseResumeButton";
import { planItems } from "./PlanReview";

const orDash = (utc: string | null) => (utc ? formatIstDateTime(utc) : "—");

export function DataJobDetailPage() {
  const { id = "" } = useParams();
  const query = useDataJob(id);

  return (
    <QueryState query={query} back={{ to: "/data-jobs", label: "Back to data jobs" }}>
      {(job) => {
        const isSync = job.type === "instrument_sync";
        return (
          <div className="flex flex-col gap-6">
            <Card>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-page-title text-text-primary">{jobTypeLabel[job.type]}</h2>
                  <span className="font-mono text-body-sm text-text-muted">{job.id}</span>
                  <StatusBadge
                    tone={jobStatusTone[job.status]}
                    label={jobStatusLabel[job.status]}
                  />
                  <span className="flex flex-wrap gap-2 sm:ml-auto">
                    <PauseResumeButton job={job} />
                    {["draft", "queued", "running", "paused"].includes(job.status) && (
                      <CancelJobButton jobId={job.id} />
                    )}
                  </span>
                </div>
                <Meter
                  label="Progress"
                  value={job.progressPercent}
                  max={100}
                  valueText={formatPercent(job.progressPercent, { decimals: 0 })}
                  warnAt={2}
                  dangerAt={2}
                />
                {job.stepsTotal > 0 && (
                  <p className="text-body-sm text-text-muted">
                    {formatQuantity(job.stepsDone)} of {formatQuantity(job.stepsTotal)} steps done
                    {job.status === "paused"
                      ? " — paused; Resume continues from the next step."
                      : ""}
                  </p>
                )}
                {job.status === "draft" && job.expiresAt && (
                  <p className="text-body-sm text-text-muted">
                    Planned, not started. The plan expires {formatIstDateTime(job.expiresAt)}.
                  </p>
                )}
                {job.summary && <p className="text-body text-text-primary">{job.summary}</p>}
                <DescriptionList
                  columns={2}
                  items={[
                    ...(isSync
                      ? []
                      : [
                          { label: "Exchange", value: job.exchange },
                          { label: "Segment", value: segmentLabel[job.segment] },
                          { label: "Symbols", value: job.symbols.join(", ") },
                          { label: "Timeframe", value: job.timeframe ?? "Ticks" },
                          {
                            label: "Period",
                            value: job.from && job.to ? formatPeriod(job.from, job.to) : "—",
                          },
                        ]),
                    {
                      label: isSync ? "Stocks synced" : "Rows written",
                      value: formatQuantity(job.rowsWritten),
                      numeric: true,
                    },
                    { label: "Created", value: formatIstDateTime(job.createdAt) },
                    { label: "Started", value: orDash(job.startedAt) },
                    { label: "Finished", value: orDash(job.finishedAt) },
                  ]}
                />
              </div>
            </Card>
            {job.plan && (
              <Card title="Plan">
                <DescriptionList columns={2} items={planItems(job.plan)} />
              </Card>
            )}
            {job.status === "failed" && (
              <EmptyState
                tone="error"
                icon={<AlertTriangle className="h-6 w-6" />}
                title="This job failed"
                description={job.error ?? "No error message."}
              />
            )}
          </div>
        );
      }}
    </QueryState>
  );
}
