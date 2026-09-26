import type { RateLimit, RateLimitRule } from "@nova/contracts";
import { Badge, Button, Card } from "@nova/ui-core";
import { Meter, formatQuantity } from "@nova/ui-trading";
import { formatIstShort } from "../../lib/format";
import { endpointLabel } from "../../lib/labels";
import { OWN_LIMIT_LABEL, WARN_PERCENT, usagePercent, windowLabel } from "../../lib/rateLimits";

export interface AccountLimitsCardProps {
  /** Names the account in the Edit buttons' accessible names. */
  accountLabel: string;
  limits: RateLimit[];
  /** Opens the edit dialog for one endpoint; omit to hide the button. */
  onEdit?: (limit: RateLimit) => void;
}

function WindowRow({ rule }: { rule: RateLimitRule }) {
  const percent = usagePercent(rule);
  const hot = percent > WARN_PERCENT;
  return (
    <div className="flex flex-col gap-1">
      <Meter
        label={
          <span className="inline-flex items-center gap-2">
            {windowLabel[rule.window]}
            {hot && <Badge tone="warning">Above {WARN_PERCENT}%</Badge>}
          </span>
        }
        value={rule.used}
        max={rule.novaLimit}
        valueText={`${formatQuantity(rule.used)} / ${formatQuantity(rule.novaLimit)} · ${Math.round(percent)}%`}
      />
      <p className="flex flex-wrap justify-between gap-x-4 text-body-sm text-text-muted">
        <span>
          {OWN_LIMIT_LABEL} <span className="font-mono">{formatQuantity(rule.novaLimit)}</span> ·
          Broker limit <span className="font-mono">{formatQuantity(rule.brokerLimit)}</span>
        </span>
        <span>
          {rule.resetsAt ? `Resets ${formatIstShort(rule.resetsAt)} IST` : "Rolling window · peak"}
        </span>
      </p>
    </div>
  );
}

/** One account's limits per endpoint and window (R3): usage against the own limit, broker limit, reset. */
export function AccountLimitsCard({ accountLabel, limits, onEdit }: AccountLimitsCardProps) {
  const updated = limits
    .map((l) => l.updatedAt)
    .sort()
    .at(-1);
  return (
    <Card
      title="Rate limits"
      actions={
        updated && (
          <span className="text-body-sm text-text-muted">Updated {formatIstShort(updated)}</span>
        )
      }
    >
      <ul className="flex flex-col divide-y divide-border-default">
        {limits.map((l) => (
          <li key={l.endpoint} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-body font-medium text-text-primary">
                {endpointLabel[l.endpoint]}
              </h4>
              <div className="flex items-center gap-2">
                {l.throttledToday > 0 ? (
                  <Badge tone="warning">Throttled {formatQuantity(l.throttledToday)}</Badge>
                ) : (
                  <Badge>No throttling</Badge>
                )}
                {onEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Edit ${endpointLabel[l.endpoint]} limits for ${accountLabel}`}
                    onClick={() => onEdit(l)}
                  >
                    Edit limits
                  </Button>
                )}
              </div>
            </div>
            {l.rules.map((rule) => (
              <WindowRow key={rule.window} rule={rule} />
            ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}
