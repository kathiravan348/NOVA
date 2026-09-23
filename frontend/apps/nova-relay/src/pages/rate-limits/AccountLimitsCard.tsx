import type { RateLimit, RateLimitWindow } from "@nova/contracts";
import { Badge, Card } from "@nova/ui-core";
import { Meter, formatQuantity } from "@nova/ui-trading";
import { formatIstShort } from "../../lib/format";
import { endpointLabel } from "../../lib/labels";

const windowLabel: Record<RateLimitWindow, string> = {
  second: "Per second",
  minute: "Per minute",
  day: "Per day",
};

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
            {l.rules.map((rule) => (
              <Meter
                key={rule.window}
                label={windowLabel[rule.window]}
                value={rule.used}
                max={rule.novaLimit}
                valueText={`${formatQuantity(rule.used)} / ${formatQuantity(rule.novaLimit)}`}
              />
            ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}
