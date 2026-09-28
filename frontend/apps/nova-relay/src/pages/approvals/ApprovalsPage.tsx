import { useSession } from "@nova/services";
import { ApprovalList } from "./ApprovalList";
import { AgentAccountCard } from "./AgentAccountCard";

export function ApprovalsPage() {
  const readOnly = useSession()?.role === "agent";
  return (
    <div className="flex flex-col gap-6">
      {!readOnly && <AgentAccountCard />}
      <ApprovalList waiting readOnly={readOnly} />
      <ApprovalList readOnly={readOnly} />
    </div>
  );
}
