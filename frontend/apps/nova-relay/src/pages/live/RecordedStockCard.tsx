import { Link } from "react-router";
import { Badge, Card } from "@nova/ui-core";
import { PriceText } from "@nova/ui-trading";
import { isMarketOpen, isStale } from "../../lib/live";

/** Today's state in market hours; null when the market is closed (no badge). */
export type RecordingStatus = "recording" | "stale" | "none" | null;

export function recordingStatus(
  at: string | null,
  secondsWithTick: number,
  now: Date,
): RecordingStatus {
  if (!isMarketOpen(now)) return null;
  if (secondsWithTick === 0) return "none";
  return isStale(at, now) ? "stale" : "recording";
}

export interface RecordedStockCardProps {
  symbol: string;
  name: string;
  /** Last price in paise; null before the first tick. */
  price: number | null;
  /** Last tick time, formatted for display (IST). */
  lastTick: string | null;
  secondsWithTick: number;
  secondsExpected: number;
  status: RecordingStatus;
}

const n = (value: number) => value.toLocaleString("en-IN");

const BADGES = {
  recording: <Badge tone="success">Recording</Badge>,
  stale: <Badge tone="warning">No recent tick</Badge>,
  none: <Badge tone="warning">No ticks today</Badge>,
};

/** One recorded stock (D78): today's status; the whole card opens the stock's recorded days. */
export function RecordedStockCard(p: RecordedStockCardProps) {
  const today =
    p.secondsExpected > 0
      ? `${n(p.secondsWithTick)} / ${n(p.secondsExpected)} (${Math.round(
          (p.secondsWithTick * 100) / p.secondsExpected,
        )}%)`
      : "—";
  return (
    <Link
      to={`/live/recorded/${p.symbol}`}
      aria-label={`Open ${p.symbol}`}
      className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-action"
    >
      <Card
        title={p.symbol}
        actions={p.status ? BADGES[p.status] : undefined}
        className="h-full transition-colors group-hover:border-action"
      >
        <>
          <p className="truncate text-body-sm text-text-muted">{p.name}</p>
          <div className="mt-2">
            {p.price === null ? (
              <span className="font-mono text-number text-text-muted">—</span>
            ) : (
              <PriceText paise={p.price} currency className="text-card-title" />
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-body-sm text-text-secondary">
            <div>
              <dt className="text-text-muted">Last tick</dt>
              <dd className="font-mono tabular-nums">{p.lastTick ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Today</dt>
              <dd className="font-mono tabular-nums">{today}</dd>
            </div>
          </dl>
        </>
      </Card>
    </Link>
  );
}
