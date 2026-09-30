import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DataJobPlanRequestSchema,
  SegmentSchema,
  type DataJob,
  type DataJobPlan,
  type DataJobPlanRequest,
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
  useSession,
} from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { DATA_START_DAY, todayIst } from "../../lib/format";
import { segmentLabel, timeframeLabel } from "../../lib/labels";
import { BulkStockPicker } from "./BulkStockPicker";
import { IndexPicker } from "./IndexPicker";
import { PlanReview } from "./PlanReview";
import { downloadPrefill, syncBatch } from "../stored-data/syncToToday";

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
/** Only these are downloaded; 3m–1h candles are built from 1-minute data (D58). */
const DOWNLOAD_TIMEFRAMES: Timeframe[] = ["1m", "1d"];
const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Plan a historical download, check what it costs, then **Start** it (D54, D57). */
export function NewDownloadPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const universe = useUniverse();
  const plan = usePlanDataJob();
  const createPlan = plan.mutate;
  const change = useChangeDataJob();
  const discard = useDeleteDataJob();
  const agent = useSession()?.role === "agent";
  const { state } = useLocation() as { state: unknown };
  const prefill = downloadPrefill(state);
  const [batch] = useState(() => syncBatch(state));
  const [position, setPosition] = useState(0);
  const firstPlan = useRef(false);
  const [symbols, setSymbols] = useState<string[]>(prefill?.stocks ?? []);
  const [indices, setIndices] = useState<string[]>(prefill?.indices ?? []);
  const [timeframe, setTimeframe] = useState<Timeframe>(prefill?.timeframe ?? "1d");
  const [from, setFrom] = useState(prefill?.from ?? DATA_START_DAY);
  const [to, setTo] = useState(prefill?.to ?? todayIst());
  const [segment, setSegment] = useState<Segment>("equity_delivery");
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const request = { symbols: [...symbols, ...indices], timeframe, from, to, segment };
  const parsed = DataJobPlanRequestSchema.safeParse(request);
  const issue = (field: string) =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  const futureTo = to > todayIst() ? "To can't be in the future" : undefined;
  const error = (field: "symbols" | "from" | "to") =>
    touched ? (field === "to" ? (futureTo ?? issue("to")) : issue(field)) : undefined;
  const busy = plan.isPending || change.isPending || discard.isPending;

  useEffect(() => {
    if (firstPlan.current || !batch[0]) return;
    firstPlan.current = true;
    if (batch.some((p) => p.to > todayIst())) {
      setFailed("To can't be in the future");
      return;
    }
    createPlan(batch[0], {
      onSuccess: (job) => {
        if (job.plan) setDraft({ ...job, plan: job.plan });
      },
      onError: (err) => setFailed(message(err, "Could not plan the download")),
    });
  }, [batch, createPlan]);

  const makePlan = async (
    mode: DownloadMode,
    active: DataJobPlanRequest = batch[position] ?? request,
  ) => {
    setFailed(null);
    try {
      if (active.to > todayIst()) throw new Error("To can't be in the future");
      const job = await plan.mutateAsync({ ...active, mode });
      if (job.plan) setDraft({ ...job, plan: job.plan });
    } catch (err) {
      setFailed(message(err, "Could not plan the download"));
    }
  };

  /** Drafts are thrown away, not left to expire, when the Owner goes back or re-plans. */
  const dropDraft = async () => {
    if (!draft) return;
    if (!agent) await discard.mutateAsync({ jobId: draft.id }).catch(() => undefined);
    setDraft(null);
  };

  const checkPlan = () => {
    setTouched(true);
    if (!parsed.success || futureTo) return;
    void makePlan(prefill?.mode ?? "skip_existing");
  };

  const nextPlan = async () => {
    setDraft(null);
    setPosition(position + 1);
    const next = batch[position + 1];
    if (next) await makePlan(next.mode ?? "skip_existing", next);
    else void navigate("/data-jobs");
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
          : `${timeframeLabel[draft.timeframe ?? timeframe]} candles for ${draft.symbols.length} stock(s) or index(es).`,
        tone: "success",
      });
      if (batch.length) await nextPlan();
      else void navigate(demo ? "/data-jobs" : `/data-jobs/${draft.id}`);
    } catch (err) {
      setFailed(message(err, "Could not start the download"));
    }
  };

  if (draft) {
    return (
      <div className="flex flex-col gap-4">
        {batch.length > 0 && (
          <p role="status">
            Plan {position + 1} of {batch.length} · {draft.symbols.join(", ")}
          </p>
        )}
        <PlanReview
          job={draft}
          busy={busy}
          onModeChange={(mode) => void dropDraft().then(() => makePlan(mode))}
          onStart={() => void start()}
          onBack={() =>
            void dropDraft().then(() => {
              if (batch.length) void navigate("/stored-data");
            })
          }
        />
        {batch.length > 0 && draft.plan.requests === 0 && (
          <Button disabled={busy} onClick={() => void dropDraft().then(nextPlan)}>
            Next plan
          </Button>
        )}
        {failed && (
          <p role="alert" className="text-body-sm text-loss">
            {failed}
          </p>
        )}
      </div>
    );
  }

  if (batch.length)
    return (
      <Card title={`Plan ${position + 1} of ${batch.length}`}>
        <p role={failed ? "alert" : "status"}>{failed ?? "Preparing the download plan…"}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {failed && (
            <Button disabled={busy} onClick={() => void makePlan("skip_existing")}>
              Retry plan
            </Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={() => void navigate("/stored-data")}>
            Back
          </Button>
        </div>
      </Card>
    );

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
            description="3 to 60-minute candles are built from 1-minute data. 1-minute data is large; the plan shows how large before anything runs."
            options={DOWNLOAD_TIMEFRAMES.map((v) => ({ value: v, label: timeframeLabel[v] }))}
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
      <IndexPicker selected={indices} onChange={setIndices} />
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
