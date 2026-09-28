import { useSession } from "@nova/services";
import { useState } from "react";
import { Tabs } from "@nova/ui-core";
import { ApprovalList } from "./ApprovalList";
import { AgentAccountCard } from "./AgentAccountCard";

export function ApprovalsPage() {
  const readOnly = useSession()?.role === "agent";
  const [busy, setBusy] = useState(false);
  return (
    <Tabs
      ariaLabel="Approvals sections"
      defaultValue="waiting"
      items={[
        {
          value: "waiting",
          label: "Waiting",
          disabled: busy,
          content: <ApprovalList waiting readOnly={readOnly} onBusyChange={setBusy} />,
        },
        {
          value: "history",
          label: "History",
          disabled: busy,
          content: <ApprovalList readOnly={readOnly} />,
        },
        ...(!readOnly
          ? [
              {
                value: "account",
                label: "Agent account",
                disabled: busy,
                content: <AgentAccountCard />,
              },
            ]
          : []),
      ]}
    />
  );
}
