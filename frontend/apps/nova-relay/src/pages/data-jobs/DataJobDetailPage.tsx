import { useParams } from "react-router";
import { AlertTriangle } from "lucide-react";
import { Button, Card, DescriptionList, EmptyState, StatusBadge, useToast } from "@nova/ui-core";
import { Meter, formatPercent, formatQuantity } from "@nova/ui-trading";
import { useDataJob } from "@nova/services";
import { QueryState } from "../../components/QueryState";
import { formatIstDateTime, formatPeriod } from "../../lib/format";
import { jobStatusLabel, jobStatusTone, jobTypeLabel, segmentLabel } from "../../lib/labels";

const orDash = (utc: string | null) => (utc ? formatIstDateTime(utc) : "—");

export function DataJobDetailPage() {
  const { id = "" } = useParams();
  const query = useDataJob(id);
  const toast = useToast();

  return (
    <QueryState query={query} back={{ to: "/data-jobs", label: "Back to data jobs" }}>
      {(job) => (
        <div className="flex flex-col gap-6">
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-page-title text-text-primary">{jobTypeLabel[job.type]}</h2>
                <span className="font-mono text-body-sm text-text-muted">{job.id}</span>
                <StatusBadge tone={jobStatusTone[job.status]} label={jobStatusLabel[job.status]} />
                {(job.status === "queued" || job.status === "running") && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="sm:ml-auto"
                    onClick={() =>
                      toast.show({
                        title: "Demo only",
                        description: "Jobs are cancelled in NOVA Atlas in Stage B.",
                      })
                    }
                  >
                    Cancel job
                  </Button>
                )}
              </div>
              <Meter
                label="Progress"
                value={job.progressPercent}
                max={100}
                valueText={formatPercent(job.progressPercent, { decimals: 0 })}
                warnAt={2}
                dangerAt={2}
              />
              <DescriptionList
                columns={2}
                items={[
                  { label: "Exchange", value: job.exchange },
                  { label: "Segment", value: segmentLabel[job.segment] },
                  { label: "Symbols", value: job.symbols.join(", ") },
                  { label: "Timeframe", value: job.timeframe ?? "Ticks" },
                  {
                    label: "Period",
                    value: job.from && job.to ? formatPeriod(job.from, job.to) : "—",
                  },
                  { label: "Rows written", value: formatQuantity(job.rowsWritten), numeric: true },
                  { label: "Created", value: formatIstDateTime(job.createdAt) },
                  { label: "Started", value: orDash(job.startedAt) },
                  { label: "Finished", value: orDash(job.finishedAt) },
                ]}
              />
            </div>
          </Card>
          {job.status === "failed" && (
            <EmptyState
              tone="error"
              icon={<AlertTriangle className="h-6 w-6" />}
              title="This job failed"
              description={job.error ?? "No error message."}
            />
          )}
        </div>
      )}
    </QueryState>
  );
}
