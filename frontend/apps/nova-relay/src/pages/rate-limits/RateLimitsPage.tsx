import { Gauge } from "lucide-react";
import { EmptyState, Skeleton } from "@nova/ui-core";
import { useBrokerAccounts, useRateLimits } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { AccountLimitsCard } from "./AccountLimitsCard";

export function RateLimitsPage() {
  const limits = useRateLimits();
  const accounts = useBrokerAccounts();

  if (limits.isPending) return <Skeleton className="h-96 w-full" />;
  if (limits.isError) {
    return <QueryError error={limits.error} onRetry={() => void limits.refetch()} />;
  }
  if (limits.data.length === 0) {
    return (
      <EmptyState
        icon={<Gauge className="h-6 w-6" />}
        title="No rate-limit data"
        description="Usage appears once an account makes API calls."
      />
    );
  }

  const accountIds = [...new Set(limits.data.map((l) => l.accountId))];
  const labelOf = (id: string) => accounts.data?.find((a) => a.id === id)?.label ?? id;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {accountIds.map((id) => (
        <AccountLimitsCard
          key={id}
          title={labelOf(id)}
          limits={limits.data.filter((l) => l.accountId === id)}
        />
      ))}
    </div>
  );
}
