import { Link, useParams } from "react-router";
import { Badge, Card, DescriptionList } from "@nova/ui-core";
import { useBrokerAccount, useRateLimits } from "@nova/services";
import { QueryState } from "../../components/QueryState";
import { formatIstDate } from "../../lib/format";
import { brokerLabel, needsLogin } from "../../lib/session";
import { LoginPrompt } from "../overview/LoginPrompt";
import { AccountLimitsCard } from "../rate-limits/AccountLimitsCard";
import { SessionCard } from "./SessionCard";

function AccountLimits({ accountId }: { accountId: string }) {
  const limits = useRateLimits();
  const own = (limits.data ?? []).filter((l) => l.accountId === accountId);
  if (own.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <AccountLimitsCard title="Rate limits" limits={own} />
      <Link to="/rate-limits" className="text-body-sm text-action-text hover:underline">
        Edit limits on the rate limits page
      </Link>
    </div>
  );
}

export function AccountDetailPage() {
  const { id = "" } = useParams();
  const query = useBrokerAccount(id);
  return (
    <QueryState query={query} back={{ to: "/accounts", label: "Back to accounts" }}>
      {(account) => (
        <div className="flex flex-col gap-6">
          {needsLogin(account) && <LoginPrompt account={account} />}
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-page-title text-text-primary">{account.label}</h2>
                {account.enabled ? <Badge tone="success">Enabled</Badge> : <Badge>Disabled</Badge>}
              </div>
              <DescriptionList
                columns={2}
                items={[
                  { label: "Broker", value: brokerLabel[account.broker] },
                  {
                    label: "Client ID",
                    value: <span className="font-mono">{account.clientId}</span>,
                  },
                  { label: "Added", value: formatIstDate(account.createdAt) },
                ]}
              />
            </div>
          </Card>
          <SessionCard session={account.session} />
          <AccountLimits accountId={account.id} />
        </div>
      )}
    </QueryState>
  );
}
