import { Link } from "react-router";
import type { LiveStockHistory } from "@nova/contracts";
import { Badge, Card } from "@nova/ui-core";
import { formatPeriod } from "../../lib/format";
import { formatBytes } from "../../lib/plan";

export interface RecordedStockCardProps {
  symbol: string;
  name: string;
  /** Summarized history (D80); undefined while it loads. */
  history: LiveStockHistory | undefined;
}

/** `3184000` → `31.8L` (lakh / crore, as Indian readers expect). */
const shortCount = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** One recorded stock (D80): days stored, gap days, ticks and size; the card opens its days. */
export function RecordedStockCard({ symbol, name, history }: RecordedStockCardProps) {
  const stored = history !== undefined && history.daysStored > 0;
  const gaps = history?.gapDays ?? 0;
  const daysStored = () => {
    if (history === undefined) return "—";
    if (!stored || !history.firstDay || !history.lastDay) return "None yet";
    const count = `${history.daysStored} ${history.daysStored === 1 ? "day" : "days"}`;
    return `${count} · ${formatPeriod(history.firstDay, history.lastDay)}`;
  };
  return (
    <Link
      to={`/live/recorded/${symbol}`}
      aria-label={`Open ${symbol}`}
      className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-action"
    >
      <Card
        title={symbol}
        actions={
          stored ? (
            gaps > 0 ? (
              <Badge tone="warning">Gap days: Yes ({gaps})</Badge>
            ) : (
              <Badge tone="success">Gap days: No</Badge>
            )
          ) : undefined
        }
        className="h-full transition-colors group-hover:border-action"
      >
        <>
          <p className="truncate text-body-sm text-text-muted">{name}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-body-sm text-text-secondary">
            <div className="col-span-2">
              <dt className="text-text-muted">Days stored</dt>
              <dd className="tabular-nums text-text-primary">{daysStored()}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Ticks</dt>
              <dd className="font-mono tabular-nums">
                {stored ? shortCount.format(history.tickCount) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Size</dt>
              <dd className="font-mono tabular-nums">
                {stored ? formatBytes(history.sizeBytes) : "—"}
              </dd>
            </div>
          </dl>
        </>
      </Card>
    </Link>
  );
}
