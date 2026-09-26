import { Landmark } from "lucide-react";
import { EmptyState, Skeleton } from "@nova/ui-core";
import { useBrokerAccounts, useBrokerProfiles, useRateLimits } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { AccountsCard } from "./AccountsCard";
import { LimitWarnings } from "./LimitWarnings";
import { ProfileCard } from "./ProfileCard";

function Profiles() {
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
    <>
      {query.data.map((p) => (
        <ProfileCard key={p.broker} profile={p} />
      ))}
    </>
  );
}

/** One place for the broker (D55): limit warnings, accounts, then the broker profile and links. */
export function BrokerPage() {
  const limits = useRateLimits();
  const accounts = useBrokerAccounts();
  return (
    <div className="flex flex-col gap-6">
      <LimitWarnings limits={limits.data ?? []} accounts={accounts.data ?? []} />
      <AccountsCard />
      <Profiles />
    </div>
  );
}
