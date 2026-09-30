import { usePageState } from "@nova/services";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ApprovalRequest } from "@nova/contracts";
import { getNow, useApprovals, useDecideRequests, type ApprovalOutcome } from "@nova/services";
import { Button, Card, DataTable, Input, Pager, StatusBadge, TextBlock } from "@nova/ui-core";
import { QueryError } from "../../components/QueryState";
import { formatIstShort } from "../../lib/format";
import { ApprovalDetails } from "./ApprovalDetails";
import { ApprovalDecision, type ApprovalDecisionValue } from "./ApprovalDecision";
import { eligible, requestName, requestSearch } from "./approvalPresentation";

export function ApprovalList({
  waiting = false,
  readOnly = false,
  onBusyChange,
}: {
  waiting?: boolean;
  readOnly?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const batch = useDecideRequests();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const paging = usePageState(`${waiting}:${search}`);
  const query = useApprovals(waiting ? "pending" : undefined, paging);
  useEffect(() => setSelected([]), [paging.page, paging.pageSize, waiting]);
  const [details, setDetails] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] = useState<ApprovalDecisionValue | null>(null);
  const [resolved, setResolved] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<ApprovalOutcome[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [now, setNow] = useState(() => getNow().getTime());
  const busy = batch.isPending;
  const { refetch } = query;
  useEffect(() => {
    const timer = setInterval(() => {
      const next = getNow().getTime();
      setNow((previous) =>
        (query.data ?? []).some((item) => eligible(item, previous) !== eligible(item, next))
          ? next
          : previous,
      );
      void refetch();
    }, 5000);
    return () => clearInterval(timer);
  }, [refetch, query.data]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const items = useMemo(
    () =>
      (query.data ?? []).filter((item) =>
        waiting ? eligible(item, now) && !resolved.includes(item.id) : item.status !== "pending",
      ),
    [query.data, waiting, now, resolved],
  );
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        requestSearch(item).toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [items, search],
  );
  const selectedRequests = items.filter((item) => selected.includes(item.id));
  useEffect(() => {
    setSelected((ids) => {
      const next = ids.filter((id) => items.some((item) => item.id === id));
      return next.length === ids.length ? ids : next;
    });
  }, [items]);
  const columns: ColumnDef<ApprovalRequest>[] = [
    {
      id: "name",
      header: "Request",
      accessorFn: requestName,
      meta: { primary: true },
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-auto whitespace-normal text-left"
          onClick={() => setDetails(row.original)}
        >
          {requestName(row.original)}
        </Button>
      ),
    },
    {
      id: "action",
      header: "Action",
      accessorFn: (item) => `${item.method} ${item.path}`,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: "createdAt",
      header: "Requested",
      cell: ({ row }) => formatIstShort(row.original.createdAt),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.status}
          tone={
            row.original.status === "failed"
              ? "danger"
              : row.original.status === "done"
                ? "success"
                : row.original.status === "pending"
                  ? "warning"
                  : "neutral"
          }
        />
      ),
    },
    ...(!waiting
      ? [
          {
            id: "result",
            header: "Response",
            accessorFn: (item: ApprovalRequest) =>
              item.resultStatus !== null ? `HTTP ${item.resultStatus}` : "No answer",
          },
        ]
      : []),
    {
      id: "details",
      header: "Details",
      enableSorting: false,
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" onClick={() => setDetails(row.original)}>
          View details
        </Button>
      ),
    },
  ];
  const confirm = async () => {
    if (!decision || busy) return;
    setNow(getNow().getTime());
    const requests = decision.requests.filter(
      (item) => eligible(item) && items.some((live) => live.id === item.id),
    );
    setProgress({ done: 0, total: requests.length });
    setOutcomes([]);
    if (requests.length === 0) {
      setDecision(null);
      return;
    }
    await batch.mutateAsync({
      requests,
      action: decision.action,
      onProgress: (outcome, done) => {
        setProgress({ done, total: requests.length });
        setOutcomes((previous) => [...previous, outcome]);
        if (outcome.decided) {
          setResolved((ids) => [...ids, outcome.id]);
          setSelected((ids) => ids.filter((id) => id !== outcome.id));
        }
      },
    });
    setDecision(null);
  };
  const selectable = waiting && !readOnly;
  return (
    <Card title={waiting ? `Waiting (${items.length})` : "History"}>
      <div className="flex flex-col gap-4">
        <DataTable
          caption={waiting ? "Waiting approval requests" : "Approval history"}
          data={filtered}
          columns={columns}
          getRowId={(item) => item.id}
          loading={query.isPending}
          error={
            query.isError ? (
              <QueryError error={query.error} onRetry={() => void refetch()} />
            ) : undefined
          }
          emptyState={
            search ? "No matching requests." : waiting ? "No requests waiting." : "No history yet."
          }
          selectedIds={selectable ? selected : undefined}
          onSelectedIdsChange={selectable ? setSelected : undefined}
          isRowSelectable={(item) => !busy && eligible(item)}
          toolbar={
            <>
              <Input
                label="Search requests"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                containerClassName="md:w-72"
              />
              {selectable && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || filtered.length === 0}
                    onClick={() =>
                      setSelected((ids) => [
                        ...new Set([...ids, ...filtered.map((item) => item.id)]),
                      ])
                    }
                  >
                    Select all shown
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || selectedRequests.length === 0}
                    onClick={() => setSelected([])}
                  >
                    Clear selection
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || selectedRequests.length === 0}
                    onClick={() => setDecision({ requests: selectedRequests, action: "Approve" })}
                  >
                    Approve selected ({selectedRequests.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy || selectedRequests.length === 0}
                    onClick={() => setDecision({ requests: selectedRequests, action: "Reject" })}
                  >
                    Reject selected ({selectedRequests.length})
                  </Button>
                </div>
              )}
            </>
          }
        />
        {progress.total > 0 && (
          <p role="status">
            {busy ? "Processing" : "Finished"}: {progress.done} of {progress.total} requests.{" "}
            {outcomes.filter((item) => item.error).length} issue(s).
          </p>
        )}
        {outcomes.some((item) => item.error) && (
          <div role="alert">
            <TextBlock
              label="Decision issues"
              text={outcomes
                .filter((item) => item.error)
                .map((item) => {
                  const request = (query.data ?? []).find((request) => request.id === item.id);
                  return `${request ? requestName(request) : item.id}: ${item.error}`;
                })
                .join("\n")}
            />
          </div>
        )}
        <Pager
          page={paging.page}
          pageSize={paging.pageSize}
          total={query.total}
          onPageChange={paging.setPage}
          onPageSizeChange={paging.setPageSize}
          loading={query.isFetching}
        />
      </div>
      <ApprovalDetails request={details} onClose={() => setDetails(null)} />
      <ApprovalDecision
        decision={decision}
        busy={busy}
        done={progress.done}
        total={progress.total}
        onCancel={() => setDecision(null)}
        onConfirm={() => void confirm()}
      />
    </Card>
  );
}
