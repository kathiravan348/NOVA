import type { ApprovalRequest } from "@nova/contracts";
import { Button, Modal, TextBlock } from "@nova/ui-core";
import { requestName } from "./approvalPresentation";

export interface ApprovalDecisionValue {
  requests: ApprovalRequest[];
  action: "Approve" | "Reject";
}

export function ApprovalDecision({
  decision,
  busy,
  done,
  total,
  onCancel,
  onConfirm,
}: {
  decision: ApprovalDecisionValue | null;
  busy: boolean;
  done: number;
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={decision !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
      title={`${decision?.action ?? "Decide"} ${decision?.requests.length ?? 0} selected request(s)?`}
      description={
        decision?.action === "Approve"
          ? "Each saved change runs once. Requests that expire before processing are skipped."
          : "These changes are refused. Nothing runs."
      }
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={decision?.action === "Reject" ? "danger" : "primary"}
            loading={busy}
            onClick={onConfirm}
          >
            {decision?.action}
          </Button>
        </>
      }
    >
      <TextBlock
        label="Selected requests"
        text={
          decision?.requests
            .map((item) => `${requestName(item)}\n${item.method} ${item.path}`)
            .join("\n\n") ?? ""
        }
      />
      {busy && (
        <p role="status">
          Processing {done} of {total}
        </p>
      )}
    </Modal>
  );
}
