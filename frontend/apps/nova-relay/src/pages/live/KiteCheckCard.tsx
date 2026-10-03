import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import type { TickCheck } from "@nova/contracts";
import { Button, Card, Skeleton, StatusBadge } from "@nova/ui-core";
import { useLiveChecks } from "@nova/services";
import { QueryError } from "../../components/QueryState";

/** Calendar date `2026-10-01` → `Thu 1 Oct`. */
const dayLabel = (isoDate: string) => formatInTimeZone(`${isoDate}T00:00:00Z`, "UTC", "EEE d MMM");

const percent = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)} %`);

const delay = (seconds: number | null) => (seconds === null ? "—" : `${seconds.toFixed(1)} s`);

function Verdict({ check }: { check: TickCheck }) {
  return check.warnings.length === 0 ? (
    <StatusBadge tone="success" label="Passed" />
  ) : (
    <StatusBadge tone="warning" label="Check" />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-mono tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}

/** The daily check of recorded ticks against Kite's 1-minute candles (D81 (4)). */
export function KiteCheckCard() {
  const checks = useLiveChecks();
  const [showDays, setShowDays] = useState(false);

  const body = () => {
    if (checks.isPending) return <Skeleton className="h-24 w-full" />;
    if (checks.isError)
      return <QueryError error={checks.error} onRetry={() => void checks.refetch()} />;
    const [latest] = checks.data;
    if (!latest)
      return (
        <p className="text-body-sm text-text-muted">
          No check yet — the first runs after 16:00 IST on a recorded day.
        </p>
      );
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body text-text-primary">{dayLabel(latest.day)}</span>
          <Verdict check={latest} />
          <span className="text-body-sm text-text-muted">
            {latest.stocksChecked} stocks checked
            {latest.stocksSkipped > 0 && ` · ${latest.stocksSkipped} skipped`}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-body-sm sm:grid-cols-4">
          <Stat label="Minute close" value={percent(latest.closeMatchPercent)} />
          <Stat label="High/low in range" value={percent(latest.rangeOkPercent)} />
          <Stat label="Minute volume" value={percent(latest.volumeMatchPercent)} />
          <Stat label="Receive delay" value={delay(latest.clockOffsetSeconds)} />
        </dl>
        {latest.warnings.length > 0 && (
          <ul role="status" className="flex flex-col gap-1 text-body-sm text-warning-text">
            {latest.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={showDays}
            onClick={() => setShowDays((open) => !open)}
          >
            {showDays ? "Hide days" : "Show days"}
          </Button>
        </div>
        {showDays && (
          <ul aria-label="Kite check days" className="flex flex-col gap-2 text-body-sm">
            {checks.data.map((check) => (
              <li
                key={check.day}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-default pt-2"
              >
                <span className="w-24 text-text-primary">{dayLabel(check.day)}</span>
                <span
                  className="font-mono tabular-nums text-text-secondary"
                  title="Minute close · High/low in range · Minute volume"
                >
                  {percent(check.closeMatchPercent)} · {percent(check.rangeOkPercent)} ·{" "}
                  {percent(check.volumeMatchPercent)}
                </span>
                <Verdict check={check} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return <Card title="Kite check">{body()}</Card>;
}
