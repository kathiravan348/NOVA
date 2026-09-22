import type { RateLimit } from "@nova/contracts";
import { Badge, Card } from "@nova/ui-core";
import { Meter, formatQuantity } from "@nova/ui-trading";
import { formatIstShort } from "../../lib/format";
import { endpointLabel } from "../../lib/labels";

export interface AccountLimitsCardProps {
  title: string;
  limits: RateLimit[];
}

export function AccountLimitsCard({ title, limits }: AccountLimitsCardProps) {
  const updated = limits
    .map((l) => l.updatedAt)
    .sort()
    .at(-1);
  return (
    <Card
      title={title}
      actions={
        updated && (
          <span className="text-body-sm text-text-muted">Updated {formatIstShort(updated)}</span>
        )
      }
    >
      <ul className="flex flex-col divide-y divide-border-default">
        {limits.map((l) => (
          <li key={l.endpoint} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-body font-medium text-text-primary">
                {endpointLabel[l.endpoint]}
              </h4>
              {l.throttledToday > 0 ? (
                <Badge tone="warning">Throttled {formatQuantity(l.throttledToday)}</Badge>
              ) : (
                <Badge>No throttling</Badge>
              )}
            </div>
            <Meter
              label="Peak per second"
              value={l.peakPerSecond}
              max={l.limitPerSecond}
              valueText={`${l.peakPerSecond} / ${l.limitPerSecond} per sec`}
            />
            {l.dailyLimit === null ? (
              <p className="flex justify-between text-body-sm">
                <span className="font-medium text-text-primary">Requests today</span>
                <span className="font-mono text-text-muted">
                  {formatQuantity(l.requestsToday)} · No daily limit
                </span>
              </p>
            ) : (
              <Meter
                label="Requests today"
                value={l.requestsToday}
                max={l.dailyLimit}
                valueText={`${formatQuantity(l.requestsToday)} / ${formatQuantity(l.dailyLimit)}`}
              />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
