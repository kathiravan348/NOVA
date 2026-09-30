import { Badge, Card } from "@nova/ui-core";
import { PriceText } from "../PriceText/PriceText";

export interface LiveStockCardProps {
  symbol: string;
  name: string;
  /** Last price in paise; null before the first tick. */
  price: number | null;
  /** Change against the previous close; null when unknown. */
  changePercent: number | null;
  /** Last tick time, already formatted for display (IST). */
  lastTick: string | null;
  secondsWithTick: number;
  secondsExpected: number;
  /** No recent tick while the market is open: the card turns amber. */
  stale?: boolean;
}

const n = (value: number) => value.toLocaleString("en-IN");

/** One stock on a live monitor: price, change, last tick time and seconds with a tick. */
export function LiveStockCard(p: LiveStockCardProps) {
  const change = p.changePercent;
  const tone =
    change === null || change === 0
      ? "text-text-primary"
      : change > 0
        ? "text-profit"
        : "text-loss";
  const sign = change === null ? "" : change > 0 ? "+" : change < 0 ? "−" : "";
  return (
    <Card
      title={p.symbol}
      className={p.stale ? "border-warning" : undefined}
      actions={p.stale ? <Badge tone="warning">No recent tick</Badge> : undefined}
    >
      <>
        <p className="truncate text-body-sm text-text-muted">{p.name}</p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          {p.price === null ? (
            <span className="font-mono text-number text-text-muted">—</span>
          ) : (
            <PriceText paise={p.price} currency className="text-card-title" />
          )}
          <span className={`font-mono text-number tabular-nums ${tone}`}>
            {change === null ? "—" : `${sign}${Math.abs(change).toFixed(2)}%`}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-body-sm text-text-secondary">
          <div>
            <dt className="text-text-muted">Last tick</dt>
            <dd className="font-mono tabular-nums">{p.lastTick ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Seconds with a tick</dt>
            <dd className="font-mono tabular-nums">
              {n(p.secondsWithTick)} / {n(p.secondsExpected)}
            </dd>
          </div>
        </dl>
      </>
    </Card>
  );
}
