import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DataJobPlanRequestSchema,
  SegmentSchema,
  TimeframeSchema,
  type DataJob,
  type DataJobPlan,
  type DownloadMode,
  type Segment,
  type Timeframe,
  type UniverseEntry,
} from "@nova/contracts";
import { Button, Card, DateTimePicker, Select, useToast } from "@nova/ui-core";
import {
  getDataMode,
  useChangeDataJob,
  useDeleteDataJob,
  usePlanDataJob,
  useUniverse,
} from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { istDaysAgo, todayIst } from "../../lib/format";
import { segmentLabel, timeframeLabel } from "../../lib/labels";
import { BulkStockPicker } from "./BulkStockPicker";
import { PlanReview } from "./PlanReview";

const columns: ColumnDef<UniverseEntry, unknown>[] = [
  { id: "symbol", header: "Symbol", accessorKey: "symbol", meta: { primary: true } },
  { id: "name", header: "Name", accessorKey: "name" },
  { id: "sector", header: "Sector", accessorKey: "sector", meta: { hideOnMobile: true } },
  {
    id: "kite",
    header: "Kite",
    accessorFn: (e) => (e.synced ? "Synced" : "Not synced"),
    meta: { hideOnMobile: true },
  },
];

type Draft = DataJob & { plan: DataJobPlan };
const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Plan a historical download, check what it costs, then **Start** it (D54, D57). */
export function NewDownloadPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const universe = useUniverse();
  const plan = usePlanDataJob();
  const change = useChangeDataJob();
  const discard = useDeleteDataJob();
  const [symbols, setSymbols] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [from, setFrom] = useState(istDaysAgo(365));
  const [to, setTo] = useState(todayIst());
  const [segment, setSegment] = useState<Segment>("equity_delivery");
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const request = { symbols, timeframe, from, to, segment };
  const parsed = DataJobPlanRequestSchema.safeParse(request);
  const issue = (field: string) =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  const futureTo = to > todayIst() ? "To can't be in the future" : undefined;
  const error = (field: "symbols" | "from" | "to") =>
    touched ? (field === "to" ? (futureTo ?? issue("to")) : issue(field)) : undefined;
  const busy = plan.isPending || change.isPending || discard.isPending;

  const makePlan = async (mode: DownloadMode) => {
    setFailed(null);
    try {
      const job = await plan.mutateAsync({ ...request, mode });
      if (job.plan) setDraft({ ...job, plan: job.plan });
    } catch (err) {
      setFailed(message(err, "Could not plan the download"));
    }
  };

  /** Drafts are thrown away, not left to expire, when the Owner goes back or re-plans. */
  const dropDraft = async () => {
    if (!draft) return;
    await discard.mutateAsync({ jobId: draft.id }).catch(() => undefined);
    setDraft(null);
  };

  const checkPlan = () => {
    setTouched(true);
    if (!parsed.success || futureTo) return;
    void makePlan("skip_existing");
  };

  const start = async () => {
    if (!draft) return;
    setFailed(null);
    try {
      await change.mutateAsync({ jobId: draft.id, action: "start" });
      const demo = getDataMode() === "mock";
      toast.show({
        title: demo ? "Download started (demo)" : "Download started",
        description: demo
          ? "Mock mode downloads nothing."
          : `${timeframeLabel[timeframe]} candles for ${draft.symbols.length} stock(s).`,
        tone: "success",
      });
      void navigate(demo ? "/data-jobs" : `/data-jobs/${draft.id}`);
    } catch (err) {
      setFailed(message(err, "Could not start the download"));
    }
  };

  if (draft) {
    return (
      <div className="flex flex-col gap-4">
        <PlanReview
          job={draft}
          busy={busy}
          onModeChange={(mode) => void dropDraft().then(() => makePlan(mode))}
          onStart={() => void start()}
          onBack={() => void dropDraft()}
        />
        {failed && (
          <p role="alert" className="text-body-sm text-loss">
            {failed}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex max-w-5xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        checkPlan();
      }}
    >
      <Card title="What to download">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Timeframe"
            description="1-minute data is large; the plan shows how large before anything runs."
            options={TimeframeSchema.options.map((v) => ({ value: v, label: timeframeLabel[v] }))}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
          />
          <Select
            label="Segment"
            options={SegmentSchema.options.map((v) => ({ value: v, label: segmentLabel[v] }))}
            value={segment}
            onChange={(e) => setSegment(e.target.value as Segment)}
          />
          <DateTimePicker
            mode="date"
            label="From"
            max={todayIst()}
            value={from}
            onChange={(v) => setFrom(v ?? "")}
            error={error("from")}
          />
          <DateTimePicker
            mode="date"
            label="To"
            max={todayIst()}
            value={to}
            onChange={(v) => setTo(v ?? "")}
            error={error("to")}
          />
        </div>
      </Card>
      <Card title={`Stocks (${symbols.length} chosen)`}>
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-text-muted">
            Only stocks synced with Kite can be downloaded. Add a whole index or sector at once.
          </p>
          {error("symbols") && (
            <p role="alert" className="text-body-sm text-loss">
              {error("symbols")}
            </p>
          )}
          <BulkStockPicker
            caption="Stocks to download"
            columns={columns}
            entries={universe.data ?? []}
            selected={symbols}
            onChange={setSymbols}
            isSelectable={(e) => e.synced}
            loading={universe.isPending}
            error={
              universe.isError ? (
                <QueryError error={universe.error} onRetry={() => void universe.refetch()} />
              ) : undefined
            }
          />
        </div>
      </Card>
      {failed && (
        <p role="alert" className="text-body-sm text-loss">
          {failed}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          Check plan
        </Button>
        <Button asChild variant="secondary">
          <Link to="/data-jobs">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
