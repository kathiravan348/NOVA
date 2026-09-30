import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { CoverageRow, DataJobPlanRequest } from "@nova/contracts";
import { Button, Modal, Select } from "@nova/ui-core";
import { useCoverage } from "@nova/services";
import { DATA_START_DAY, formatCalendarDate, todayIst } from "../../lib/format";
import { needsSync, prepareSync, syncDateDays, type SyncBatchState } from "./syncToToday";

export interface SyncToTodayButtonProps {
  shown: CoverageRow[];
  filtered: boolean;
}

/** Business flow composed from the existing shared button and confirmation dialog. */
export function SyncToTodayButton({ shown, filtered }: SyncToTodayButtonProps) {
  const navigate = useNavigate();
  const today = todayIst();
  const daily = useCoverage({ timeframe: "1d", from: DATA_START_DAY, to: today });
  const minute = useCoverage({ timeframe: "1m", from: DATA_START_DAY, to: today });
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("shown");
  const [plans, setPlans] = useState<DataJobPlanRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const allowed = new Set(shown.map((r) => r.symbol));
  const series = [daily, minute].map((query, i) => ({
    timeframe: i === 0 ? ("1d" as const) : ("1m" as const),
    rows: (query.data?.rows ?? []).filter((r) => scope === "all" || allowed.has(r.symbol)),
  }));
  const candidates = new Set(
    series.flatMap((s) => s.rows.filter((r) => needsSync(r, today)).map((r) => r.symbol)),
  );
  const missing = new Set(
    series.flatMap((s) =>
      s.rows.filter((r) => r.missingDays > (r.unavailableDays ?? 0)).map((r) => r.symbol),
    ),
  );
  const last = shown
    .map((r) => r.lastDay)
    .filter((d): d is string => d !== null)
    .sort()
    .at(-1);
  const loading = daily.isPending || minute.isPending;
  const failed = daily.isError || minute.isError;
  const key = JSON.stringify(series);

  useEffect(() => {
    if (!open || loading || failed) return;
    let current = true;
    setPlans(null);
    setError(null);
    void prepareSync(JSON.parse(key) as typeof series, today).then(
      (requests) => current && setPlans(requests),
      (err: unknown) =>
        current && setError(err instanceof Error ? err.message : "Could not check missing days"),
    );
    return () => {
      current = false;
    };
  }, [open, loading, failed, key, today, attempt]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={loading || failed || candidates.size === 0}
        onClick={() => {
          setScope("shown");
          setOpen(true);
        }}
      >
        {loading
          ? "Checking stored data…"
          : !failed && candidates.size === 0
            ? "Up to date"
            : "Sync to today"}
      </Button>
      <p className="text-body-sm text-text-muted">
        Last stored day: {last ? formatCalendarDate(last) : "Nothing stored"}. {missing.size} stocks
        with missing days.
      </p>
      {failed && (
        <Button
          variant="secondary"
          onClick={() => {
            void daily.refetch();
            void minute.refetch();
          }}
        >
          Retry sync check
        </Button>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Sync to today"
        description="Review each download plan before starting it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!plans?.length}
              onClick={() => {
                const state: SyncBatchState = { syncPlans: plans ?? [] };
                void navigate("/data-jobs/new", { state });
              }}
            >
              Review plan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {filtered && (
            <Select
              label="Stocks to sync"
              value={scope}
              onChange={(e) => {
                setPlans(null);
                setScope(e.target.value);
              }}
              options={[
                { value: "shown", label: "This group" },
                { value: "all", label: "All stocks" },
              ]}
            />
          )}
          <p>
            {plans ? new Set(plans.flatMap((p) => p.symbols)).size : candidates.size} stocks · 1
            minute (1m) and 1 day (1d).
          </p>
          {error ? (
            <>
              <p role="alert">{error}</p>
              <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Retry
              </Button>
            </>
          ) : plans === null ? (
            <p role="status">Checking missing dates…</p>
          ) : (
            <p>
              {plans.length === 0
                ? "Up to date."
                : `${syncDateDays(plans).toLocaleString("en-IN")} date days to check across stocks and timeframes.`}
            </p>
          )}
          <p className="text-body-sm text-text-muted">
            Known unavailable dates are excluded. Date ranges may include holidays and already
            stored days; the plan checks what needs fetching. Nothing starts until Start.
          </p>
        </div>
      </Modal>
    </div>
  );
}
