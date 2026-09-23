import { ExternalLink, Landmark } from "lucide-react";
import type { BrokerProfile } from "@nova/contracts";
import { Card, DescriptionList, EmptyState, Skeleton } from "@nova/ui-core";
import { useBrokerProfiles } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatCalendarDate } from "../../lib/format";

function ProfileCard({ profile }: { profile: BrokerProfile }) {
  const p = profile;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title={p.name} className="lg:col-span-2">
        <DescriptionList
          columns={2}
          items={[
            { label: "API", value: p.api },
            { label: "Plan", value: p.plan },
            {
              label: "Subscription renews",
              value: p.subscriptionRenewsOn ? formatCalendarDate(p.subscriptionRenewsOn) : "—",
            },
            {
              label: "API key",
              value: <span className="font-mono">{`•••• ${p.apiKeyLast4}`}</span>,
            },
            { label: "Redirect URL", value: <span className="break-all">{p.redirectUrl}</span> },
            {
              label: "Postback URL",
              value: p.postbackUrl ? <span className="break-all">{p.postbackUrl}</span> : "None",
            },
            {
              label: "Static IP",
              value: p.staticIp ? (
                <span className="font-mono">{p.staticIp}</span>
              ) : (
                "Not registered (needed from Phase 3)"
              ),
            },
            { label: "Session", value: p.sessionRule },
          ]}
        />
      </Card>
      <Card title="Useful links">
        {p.links.length === 0 ? (
          <p className="text-body-sm text-text-muted">No links.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {p.links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-body text-action-text hover:underline"
                >
                  {link.label}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Broker API and plan facts with useful links, all from data (R4, D28). */
export function BrokerPage() {
  const query = useBrokerProfiles();
  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) {
    return (
      <EmptyState
        icon={<Landmark className="h-6 w-6" />}
        title="No broker profile"
        description="Broker details appear once a broker is set up."
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {query.data.map((p) => (
        <ProfileCard key={p.broker} profile={p} />
      ))}
    </div>
  );
}
