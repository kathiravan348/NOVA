import type { LiveDaySummary } from "@nova/contracts";
import { Badge, Card } from "@nova/ui-core";
import { formatCalendarDate } from "../../lib/format";
import { formatBytes } from "../../lib/plan";

/** One recorded day: ticks, 1-second candles, recorder faults vs seconds with no trade, size. */
export function DayCard({ day }: { day: LiveDaySummary }) {
  const n = (v: number) => v.toLocaleString("en-IN");
  return (
    <Card
      title={formatCalendarDate(day.day)}
      actions={
        day.missingSeconds > 0 ? (
          <Badge tone="warning">{n(day.missingSeconds)} missed by the recorder</Badge>
        ) : (
          <Badge tone="success">No recorder gaps</Badge>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-3 text-body-sm">
        <Stat label="Ticks" value={n(day.tickCount)} />
        <Stat label="1-second candles" value={n(day.candleCount)} />
        <Stat label="Missing seconds (recorder)" value={n(day.missingSeconds)} />
        <Stat label="No trade seconds" value={n(day.noTradeSeconds)} />
        <Stat label="Size" value={formatBytes(day.sizeBytes)} />
      </dl>
    </Card>
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
