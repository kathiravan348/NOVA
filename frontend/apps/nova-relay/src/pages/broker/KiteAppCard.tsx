import { useState } from "react";
import { Badge, Button, Card, DescriptionList, Skeleton } from "@nova/ui-core";
import { useKiteApp } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatCalendarDate } from "../../lib/format";
import { KiteAppDetailsModal } from "./KiteAppDetailsModal";
import { KiteKeysModal } from "./KiteKeysModal";
import { PassphraseCheckModal } from "./PassphraseCheckModal";

type Dialog = "keys" | "details" | "check" | null;

/** The account's own Kite app (D55): key last 4, whether the secret is saved, app details. */
export function KiteAppCard({ accountId }: { accountId: string }) {
  const query = useKiteApp(accountId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  const app = query.data;

  return (
    <Card
      title="Kite app"
      actions={
        app.secretSaved ? (
          <Badge tone="success">Keys saved</Badge>
        ) : (
          <Badge tone="warning">Not set up</Badge>
        )
      }
      footer={
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setDialog("keys")}>Set key and secret</Button>
          <Button variant="secondary" onClick={() => setDialog("details")}>
            Edit details
          </Button>
          {app.secretSaved && (
            <Button variant="secondary" onClick={() => setDialog("check")}>
              Test passphrase
            </Button>
          )}
        </div>
      }
    >
      <DescriptionList
        columns={2}
        items={[
          {
            label: "API key",
            value: app.apiKeyLast4 ? (
              <span className="font-mono">{`•••• ${app.apiKeyLast4}`}</span>
            ) : (
              "Not set"
            ),
          },
          {
            label: "API secret",
            value: app.secretSaved ? "Saved, locked by your passphrase" : "Not saved",
          },
          { label: "Plan", value: app.plan ?? "—" },
          {
            label: "Renews on",
            value: app.subscriptionRenewsOn ? formatCalendarDate(app.subscriptionRenewsOn) : "—",
          },
          {
            label: "Redirect URL",
            value: (
              <span className="flex flex-col gap-1">
                <span className="break-all font-mono">{app.redirectUrl}</span>
                <span className="text-body-sm text-text-muted">Paste this into your Kite app.</span>
              </span>
            ),
          },
          {
            label: "Postback URL",
            value: app.postbackUrl ? <span className="break-all">{app.postbackUrl}</span> : "None",
          },
          {
            label: "Static IP",
            value: app.staticIp ? (
              <span className="font-mono">{app.staticIp}</span>
            ) : (
              "Not registered (needed from Phase 3)"
            ),
          },
        ]}
      />
      <KiteKeysModal
        accountId={accountId}
        hasKeys={app.secretSaved}
        open={dialog === "keys"}
        onClose={close}
      />
      <KiteAppDetailsModal app={app} open={dialog === "details"} onClose={close} />
      <PassphraseCheckModal accountId={accountId} open={dialog === "check"} onClose={close} />
    </Card>
  );
}
