import type { BrokerSession } from "@nova/contracts";
import { Card, DescriptionList, StatusBadge } from "@nova/ui-core";
import { getNow } from "@nova/services";
import { formatIstDateTime } from "../../lib/format";
import { sessionLabel, sessionTone, timeLeft } from "../../lib/session";

export function SessionCard({ session }: { session: BrokerSession }) {
  const left =
    session.status === "active" && session.expiresAt ? timeLeft(session.expiresAt, getNow()) : null;
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
          { label: "Time left", value: left ?? "—", numeric: left !== null },
        ]}
      />
    </Card>
  );
}
