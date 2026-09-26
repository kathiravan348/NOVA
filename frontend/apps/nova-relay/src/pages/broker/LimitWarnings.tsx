import { Link } from "react-router";
import { AlertTriangle } from "lucide-react";
import type { BrokerAccount, RateLimit } from "@nova/contracts";
import { Card } from "@nova/ui-core";
import { endpointLabel } from "../../lib/labels";
import { OWN_LIMIT_LABEL, WARN_PERCENT, hotWindows, windowLabel } from "../../lib/rateLimits";

export interface LimitWarningsProps {
  limits: RateLimit[];
  accounts: BrokerAccount[];
}

/**
 * Lists windows above 80% of the own limit (R3); renders nothing when all are below.
 * Each account name links to its page, where the limits are edited.
 */
export function LimitWarnings({ limits, accounts }: LimitWarningsProps) {
  const hot = hotWindows(limits);
  if (hot.length === 0) return null;
  const labelOf = (id: string) => accounts.find((a) => a.id === id)?.label ?? id;
  return (
    <Card>
      <div role="status" className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-body font-medium text-warning-text">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          {hot.length} {hot.length === 1 ? "window is" : "windows are"} above {WARN_PERCENT}% of the{" "}
          {OWN_LIMIT_LABEL}
        </p>
        <ul className="flex flex-col gap-1 text-body-sm text-text-secondary">
          {hot.map((w) => (
            <li key={`${w.accountId}:${w.endpoint}:${w.window}`}>
              <Link to={`/broker/${w.accountId}`} className="text-action-text hover:underline">
                {labelOf(w.accountId)}
              </Link>{" "}
              · {endpointLabel[w.endpoint]} · {windowLabel[w.window].toLowerCase()}:{" "}
              <span className="font-mono">{Math.round(w.percent)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
