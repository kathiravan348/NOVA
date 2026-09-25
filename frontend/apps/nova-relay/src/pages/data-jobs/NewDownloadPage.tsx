import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DataJobCreateSchema,
  SegmentSchema,
  TimeframeSchema,
  type Segment,
  type Timeframe,
  type UniverseEntry,
} from "@nova/contracts";
import { Button, Card, DataTable, DateTimePicker, Select, useToast } from "@nova/ui-core";
import { getDataMode, useCreateDataJob, useUniverse } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { istDaysAgo, todayIst } from "../../lib/format";
import { segmentLabel, timeframeLabel } from "../../lib/labels";

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

/** Queue a historical candle download (D54): stocks, timeframe, period, segment. */
export function NewDownloadPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const universe = useUniverse();
  const create = useCreateDataJob();
  const [symbols, setSymbols] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [from, setFrom] = useState(istDaysAgo(365));
  const [to, setTo] = useState(todayIst());
  const [segment, setSegment] = useState<Segment>("equity_delivery");
  const [touched, setTouched] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const parsed = DataJobCreateSchema.safeParse({ symbols, timeframe, from, to, segment });
  const issue = (field: string) =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  const futureTo = to > todayIst() ? "To can't be in the future" : undefined;
  const error = (field: "symbols" | "from" | "to") =>
    touched ? (field === "to" ? (futureTo ?? issue("to")) : issue(field)) : undefined;

  const submit = async () => {
    setTouched(true);
    if (!parsed.success || futureTo) return;
    setFailed(null);
    try {
      const job = await create.mutateAsync(parsed.data);
      const demo = getDataMode() === "mock";
      toast.show({
        title: demo ? "Download queued (demo)" : "Download queued",
        description: demo
          ? "Mock mode downloads nothing."
          : `${timeframeLabel[timeframe]} candles for ${job.symbols.length} stock(s).`,
        tone: "success",
      });
      void navigate(demo ? "/data-jobs" : `/data-jobs/${job.id}`);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Could not queue the download");
    }
  };

  return (
    <form
      noValidate
      className="flex max-w-5xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Card title="What to download">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Timeframe"
            description="1-minute data is large; start with a few stocks."
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
            Only stocks synced with Kite can be downloaded. A new stock needs a sync first.
          </p>
          {error("symbols") && (
            <p role="alert" className="text-body-sm text-loss">
              {error("symbols")}
            </p>
          )}
          <DataTable
            caption="Stocks to download"
            columns={columns}
            data={universe.data ?? []}
            getRowId={(e) => e.symbol}
            loading={universe.isPending}
            error={
              universe.isError ? (
                <QueryError error={universe.error} onRetry={() => void universe.refetch()} />
              ) : undefined
            }
            selectedIds={symbols}
            isRowSelectable={(e) => e.synced}
            onSelectedIdsChange={setSymbols}
            search={{
              label: "Search stocks",
              placeholder: "Symbol or name",
              getText: (e) => `${e.symbol} ${e.name} ${e.sector}`,
            }}
            pageSize={10}
          />
        </div>
      </Card>
      {failed && (
        <p role="alert" className="text-body-sm text-loss">
          {failed}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={create.isPending}>
          Queue download
        </Button>
        <Button asChild variant="secondary">
          <Link to="/data-jobs">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
