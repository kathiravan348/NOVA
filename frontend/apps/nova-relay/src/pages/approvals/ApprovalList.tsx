import { useEffect, useState } from "react";
import type { ApprovalRequest } from "@nova/contracts";
import { useApprovals, useApproveRequest, useRejectRequest } from "@nova/services";
import { Button, Card, LoadMore, Modal, Skeleton, StatusBadge, useToast } from "@nova/ui-core";
import { QueryError } from "../../components/QueryState";
import { formatIstShort } from "../../lib/format";

export function ApprovalList({
  waiting = false,
  readOnly = false,
}: {
  waiting?: boolean;
  readOnly?: boolean;
}) {
  const query = useApprovals(waiting ? "pending" : undefined);
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const toast = useToast();
  const [decision, setDecision] = useState<{
    request: ApprovalRequest;
    action: "Approve" | "Reject";
  } | null>(null);
  const busy = approve.isPending || reject.isPending;
  const { refetch } = query;
  useEffect(() => {
    if (waiting) return;
    const timer = setInterval(() => void refetch(), 5000);
    return () => clearInterval(timer);
  }, [waiting, refetch]);
  const items = (query.data ?? []).filter((item) =>
    waiting ? item.status === "pending" : item.status !== "pending",
  );
  const confirm = async () => {
    if (!decision) return;
    try {
      await (decision.action === "Approve" ? approve : reject).mutateAsync(decision.request.id);
      setDecision(null);
    } catch (error) {
      toast.show({
        title: "Could not decide request",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "danger",
      });
    }
  };
  return (
    <Card title={waiting ? "Waiting" : "History"}>
      {query.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          {items.length === 0 && (
            <p className="text-body-sm text-text-muted">
              {waiting ? "No requests waiting." : "No history yet."}
            </p>
          )}
          {items.map((item) => (
            <Card
              key={item.id}
              title={
                <span className="break-all font-mono text-body-sm">
                  {item.method} {item.path}
                  {item.query ? `?${item.query}` : ""}
                </span>
              }
            >
              <div className="flex flex-col gap-3">
                <p className="text-body-sm text-text-secondary">
                  {formatIstShort(item.createdAt)} · {item.agentName}
                </p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-body-sm">
                  {JSON.stringify(item.body, null, 2)}
                </pre>
                <StatusBadge
                  className="self-start"
                  label={item.status}
                  tone={
                    item.status === "failed"
                      ? "danger"
                      : item.status === "done"
                        ? "success"
                        : item.status === "pending"
                          ? "warning"
                          : "neutral"
                  }
                />
                {!waiting && (
                  <p className="break-all font-mono text-body-sm text-text-secondary">
                    {item.resultStatus !== null ? `HTTP ${item.resultStatus}` : "No answer"}
                    {item.resultBody ? ` · ${item.resultBody.slice(0, 300)}` : ""}
                  </p>
                )}
                {waiting && !readOnly && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => setDecision({ request: item, action: "Approve" })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDecision({ request: item, action: "Reject" })}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
          <LoadMore
            hasMore={query.hasNextPage}
            loading={query.isFetchingNextPage}
            onLoadMore={() => void query.fetchNextPage()}
          />
        </div>
      )}
      <Modal
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDecision(null);
        }}
        title={`${decision?.action ?? "Decide"} this request?`}
        description={
          decision?.action === "Approve"
            ? "This runs the saved change as the agent. Check its method, path and body."
            : "This refuses the change. Nothing runs."
        }
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              variant={decision?.action === "Reject" ? "danger" : "primary"}
              loading={busy}
              onClick={() => void confirm()}
            >
              {decision?.action}
            </Button>
          </>
        }
      >
        <pre className="whitespace-pre-wrap break-all font-mono text-body-sm">
          {decision &&
            `${decision.request.method} ${decision.request.path}${decision.request.query ? `?${decision.request.query}` : ""}\n${JSON.stringify(decision.request.body, null, 2)}`}
        </pre>
      </Modal>
    </Card>
  );
}
