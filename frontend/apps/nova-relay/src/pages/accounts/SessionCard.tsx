import type { BrokerSession } from "@nova/contracts";
import { Card, DescriptionList, StatusBadge } from "@nova/ui-core";
import { formatIstDateTime } from "../../lib/format";
import { sessionLabel, sessionTone } from "../../lib/session";

export function SessionCard({ session }: { session: BrokerSession }) {
  return (
    <Card
      title="Kite session"
      actions={
        <StatusBadge tone={sessionTone[session.status]} label={sessionLabel[session.status]} />
      }
    >
      <DescriptionList
        items={[
          {
            label: "Logged in",
            value: session.loggedInAt ? formatIstDateTime(session.loggedInAt) : "—",
          },
          {
            label: "Expires",
            value: session.expiresAt ? formatIstDateTime(session.expiresAt) : "—",
          },
        ]}
      />
    </Card>
  );
}
