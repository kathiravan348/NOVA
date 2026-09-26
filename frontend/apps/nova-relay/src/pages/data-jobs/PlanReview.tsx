import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DataJob, DataJobPlan, DataJobPlanSymbol, DownloadMode } from "@nova/contracts";
import { Button, Card, DataTable, DescriptionList, EmptyState, Select } from "@nova/ui-core";
import { formatQuantity } from "@nova/ui-trading";
import { formatPeriod } from "../../lib/format";
import { formatBytes, formatDuration, formatStart } from "../../lib/plan";
import { timeframeLabel } from "../../lib/labels";

const modeOptions: { value: DownloadMode; label: string }[] = [
  { value: "skip_existing", label: "Skip data already there" },
  { value: "overwrite", label: "Overwrite" },
];

const columns: ColumnDef<DataJobPlanSymbol, unknown>[] = [
  { id: "symbol", header: "Stock", accessorKey: "symbol", meta: { primary: true } },
  {
    id: "stored",
    header: "Already stored",
    accessorFn: (s) =>
      s.existingFrom && s.existingTo ? formatPeriod(s.existingFrom, s.existingTo) : "—",
  },
  {
    id: "fetch",
    header: "Steps to fetch",
    accessorFn: (s) => s.steps - s.skippedSteps,
    meta: { numeric: true },
    cell: ({ row }) =>
      `${formatQuantity(row.original.steps - row.original.skippedSteps)} of ${formatQuantity(row.original.steps)}`,
  },
];

/** Totals of a plan, shared by the review and the job page of a draft. */
export function planItems(plan: DataJobPlan) {
  return [
    {
      label: "Steps to fetch",
      value: `${formatQuantity(plan.requests)} of ${formatQuantity(plan.steps)}`,
      numeric: true,
    },
    {
      label: "Already stored",
      value: `${formatQuantity(plan.skippedSteps)} ${plan.skippedSteps === 1 ? "step" : "steps"}`,
      numeric: true,
    },
    { label: "Rows", value: `~${formatQuantity(plan.estimatedRows)}`, numeric: true },
    { label: "Size", value: formatBytes(plan.estimatedBytes) },
    { label: "Time", value: formatDuration(plan.estimatedSeconds) },
    { label: "Starts", value: formatStart(plan) },
  ];
}

export interface PlanReviewProps {
  job: DataJob & { plan: DataJobPlan };
  busy: boolean;
  onModeChange: (mode: DownloadMode) => void;
  onStart: () => void;
  onBack: () => void;
}

/** The plan of a download before **Start** (D57 (2)): what is stored, what it costs, when it starts. */
export function PlanReview({ job, busy, onModeChange, onStart, onBack }: PlanReviewProps) {
  const { plan } = job;
  const nothing = plan.requests === 0;
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Card title="Check the plan">
        <div className="flex flex-col gap-4">
          <p className="text-body-sm text-text-muted">
            {job.timeframe ? timeframeLabel[job.timeframe] : ""} candles,{" "}
            {job.from && job.to ? formatPeriod(job.from, job.to) : ""}. Nothing is downloaded until
            you press Start.
          </p>
          <Select
            label="Data already stored"
            description="Skip saves time and Kite requests. Overwrite downloads everything again."
            options={modeOptions}
            value={job.mode ?? "skip_existing"}
            disabled={busy}
            onChange={(e) => onModeChange(e.target.value as DownloadMode)}
          />
          {nothing ? (
            <EmptyState
              icon={<CheckCircle2 className="h-6 w-6" />}
              title="Nothing to download"
              description="Every step is already stored. Choose Overwrite to download it again."
            />
          ) : (
            <DescriptionList columns={2} items={planItems(plan)} />
          )}
          {plan.warnings.length > 0 && (
            <ul className="flex flex-col gap-1" aria-label="Warnings">
              {plan.warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2 text-body-sm text-warning-text">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
      <DataTable
        caption="Plan per stock"
        columns={columns}
        data={plan.perSymbol}
        getRowId={(s) => s.symbol}
        pageSize={10}
      />
      <div className="flex flex-wrap gap-3">
        {!nothing && (
          <Button type="button" disabled={busy} onClick={onStart}>
            Start
          </Button>
        )}
        <Button type="button" variant="secondary" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
