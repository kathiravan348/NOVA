import { Link } from "react-router";
import { KeyRound, TriangleAlert } from "lucide-react";
import type { BrokerAccount } from "@nova/contracts";
import { Button, Card, useToast } from "@nova/ui-core";
import { brokerLoginUrl, getDataMode, useKiteApp } from "@nova/services";

/**
 * Daily Kite login reminder. Real mode opens the Kite login (D39, D48); mock mode only shows a toast.
 * Without saved Kite keys (D55) it points to the account page to set them up first.
 */
export function LoginPrompt({ account }: { account: BrokerAccount }) {
  const toast = useToast();
  const app = useKiteApp(account.id);
  const needsSetup = app.data !== undefined && !app.data.secretSaved;
  return (
    <Card className="border-warning">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TriangleAlert className="h-5 w-5 shrink-0 text-warning-text" aria-hidden="true" />
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-body font-medium text-text-primary">
            Daily login needed for {account.label}
          </p>
          <p className="text-body-sm text-text-secondary">
            {needsSetup
              ? "Save this account's Kite API key and secret first, then log in."
              : "Kite access tokens expire every day. Log in once each trading day before strategies can use this account."}
          </p>
        </div>
        {needsSetup ? (
          <Button asChild className="shrink-0">
            <Link to={`/broker/${account.id}`}>Set up the Kite app</Link>
          </Button>
        ) : (
          <Button
            className="shrink-0"
            onClick={() => {
              if (getDataMode() === "real") {
                window.location.assign(brokerLoginUrl(account.id));
                return;
              }
              toast.show({
                title: "Demo only",
                description: "Kite login opens in real mode. No broker call was made.",
              });
            }}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Log in to Kite
          </Button>
        )}
      </div>
    </Card>
  );
}
