import type { ApprovalRequest } from "@nova/contracts";
import { DescriptionList, Modal, TextBlock } from "@nova/ui-core";
import { formatIstShort } from "../../lib/format";
import { requestName } from "./approvalPresentation";

export function ApprovalDetails({
  request,
  onClose,
}: {
  request: ApprovalRequest | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Request details"
      className="break-all"
      description={request ? requestName(request) : undefined}
    >
      {request && (
        <div className="flex flex-col gap-4">
          <DescriptionList
            items={[
              { label: "Request", value: request.id },
              { label: "Action", value: `${request.method} ${request.path}` },
              { label: "Query", value: request.query || "None" },
              { label: "Requested by", value: request.agentName },
              { label: "Created", value: formatIstShort(request.createdAt) },
              { label: "Status", value: request.status },
              {
                label: "Decided",
                value: request.decidedAt ? formatIstShort(request.decidedAt) : "Not yet",
              },
              { label: "Decided by", value: request.decidedBy ?? "None" },
              {
                label: "Response",
                value: request.resultStatus !== null ? `HTTP ${request.resultStatus}` : "No answer",
              },
            ]}
          />
          <TextBlock label="Request body" text={JSON.stringify(request.body, null, 2)} />
          <TextBlock label="Response body" text={request.resultBody ?? ""} />
        </div>
      )}
    </Modal>
  );
}
