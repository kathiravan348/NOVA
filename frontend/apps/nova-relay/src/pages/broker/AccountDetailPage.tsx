import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import type { RateLimit } from "@nova/contracts";
import { Badge, Card, DescriptionList, useToast } from "@nova/ui-core";
import { useBrokerAccount, useRateLimits } from "@nova/services";
import { QueryState } from "../../components/QueryState";
import { formatIstDate } from "../../lib/format";
import { brokerLabel, needsLogin } from "../../lib/session";
import { LoginPrompt } from "../overview/LoginPrompt";
import { AccountLimitsCard } from "./AccountLimitsCard";
import { EditLimitsModal } from "./EditLimitsModal";
import { FinishLoginModal } from "./FinishLoginModal";
import { KiteAppCard } from "./KiteAppCard";
import { SessionCard } from "./SessionCard";

function AccountLimits({ accountId, label }: { accountId: string; label: string }) {
  const limits = useRateLimits();
  const [editing, setEditing] = useState<RateLimit | null>(null);
  const own = (limits.data ?? []).filter((l) => l.accountId === accountId);
  if (own.length === 0) return null;
  return (
    <>
      <AccountLimitsCard accountLabel={label} limits={own} onEdit={setEditing} />
      <EditLimitsModal accountLabel={label} limit={editing} onClose={() => setEditing(null)} />
    </>
  );
}

/**
 * Shows the outcome of a Kite login once (`?kite=connected|failed`, D39) and removes it from the URL.
 * `?kite=finish` (D55) opens the passphrase prompt instead.
 */
function useKiteResult(): void {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const result = params.get("kite");
  // Showing a toast changes the toast context; without this guard the effect would repeat forever.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if ((result !== "connected" && result !== "failed") || shown.current === result) return;
    shown.current = result;
    toast.show(
      result === "connected"
        ? { title: "Kite connected", description: "Today's session is active.", tone: "success" }
        : {
            title: "Kite login failed",
            description: "See the audit log for the reason.",
            tone: "danger",
          },
    );
    setParams({}, { replace: true });
  }, [result, setParams, toast]);
}

export function AccountDetailPage() {
  const { id = "" } = useParams();
  const query = useBrokerAccount(id);
  const [params, setParams] = useSearchParams();
  useKiteResult();
  return (
    <QueryState query={query} back={{ to: "/broker", label: "Back to broker" }}>
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
          <KiteAppCard accountId={account.id} />
          <AccountLimits accountId={account.id} label={account.label} />
          <FinishLoginModal
            accountId={account.id}
            accountLabel={account.label}
            open={params.get("kite") === "finish"}
            onClose={() => setParams({}, { replace: true })}
          />
        </div>
      )}
    </QueryState>
  );
}
