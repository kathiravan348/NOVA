import { Link } from "react-router";
import { CircleCheck } from "lucide-react";
import { Card, Skeleton, StatCard } from "@nova/ui-core";
import { useAuditEntries, useBrokerAccounts } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatIstShort } from "../../lib/format";
import { needsLogin } from "../../lib/session";
import { LoginPrompt } from "./LoginPrompt";

function RecentActivity() {
  const audit = useAuditEntries();
  const recent = [...(audit.data ?? [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  return (
    <Card
      title="Recent activity"
      actions={
        <Link to="/audit" className="text-body-sm text-action-text hover:underline">
          View audit log
        </Link>
      }
    >
      {audit.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : audit.isError ? (
        <QueryError error={audit.error} onRetry={() => void audit.refetch()} />
      ) : recent.length === 0 ? (
        <p className="text-body-sm text-text-muted">No activity yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-default">
          {recent.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
              <span className="shrink-0 font-mono text-body-sm text-text-muted sm:w-28">
                {formatIstShort(entry.at)}
              </span>
              <span className="text-body text-text-primary">{entry.summary}</span>
              <span className="text-body-sm text-text-muted sm:ml-auto">{entry.actorName}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function OverviewPage() {
  const accounts = useBrokerAccounts();

  if (accounts.isPending) return <Skeleton className="h-64 w-full" />;
  if (accounts.isError) {
    return <QueryError error={accounts.error} onRetry={() => void accounts.refetch()} />;
  }

  const list = accounts.data;
  const needing = list.filter(needsLogin);
  const count = (n: number) => <span className="font-mono">{n}</span>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Accounts" value={count(list.length)} />
        <StatCard
          label="Active sessions"
          value={count(list.filter((a) => a.session.status === "active").length)}
        />
        <StatCard label="Need login" value={count(needing.length)} />
        <StatCard label="Disabled" value={count(list.filter((a) => !a.enabled).length)} />
      </div>
      {needing.length > 0 ? (
        <div className="flex flex-col gap-3">
          {needing.map((account) => (
            <LoginPrompt key={account.id} account={account} />
          ))}
        </div>
      ) : (
        <Card>
          <p className="flex items-center gap-2 text-body text-text-primary">
            <CircleCheck className="h-5 w-5 text-profit-text" aria-hidden="true" />
            All enabled accounts have an active session.
          </p>
        </Card>
      )}
      <RecentActivity />
    </div>
  );
}
