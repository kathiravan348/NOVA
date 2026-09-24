import { useSearchParams } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import type { AuditEntry } from "@nova/contracts";
import { DataTable, EmptyState, Select, LoadMore } from "@nova/ui-core";
import { useAuditEntries } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatIstShort } from "../../lib/format";
import {
  AUDIT_GROUPS,
  auditActionLabel,
  auditGroup,
  auditGroupLabel,
  type AuditGroup,
} from "../../lib/labels";

const columns: ColumnDef<AuditEntry, unknown>[] = [
  {
    id: "at",
    header: "Time",
    accessorKey: "at",
    meta: { numeric: true },
    cell: ({ getValue }) => formatIstShort(getValue() as string),
  },
  { id: "summary", header: "Summary", accessorKey: "summary", meta: { primary: true } },
  { id: "actor", header: "Actor", accessorKey: "actorName" },
  { id: "action", header: "Action", accessorFn: (e) => auditActionLabel[e.action] },
  {
    id: "target",
    header: "Target",
    accessorFn: (e) => (e.targetType && e.targetId ? `${e.targetType} · ${e.targetId}` : "—"),
    meta: { hideOnMobile: true },
  },
  {
    id: "ip",
    header: "IP",
    accessorFn: (e) => e.ip ?? "—",
    meta: { hideOnMobile: true },
    cell: ({ getValue }) => <span className="font-mono">{getValue() as string}</span>,
  },
];

const isGroup = (v: string | null): v is AuditGroup =>
  v !== null && (AUDIT_GROUPS as readonly string[]).includes(v);

export function AuditPage() {
  const query = useAuditEntries();
  const [params, setParams] = useSearchParams();
  const raw = params.get("group");
  const group = isGroup(raw) ? raw : null;
  const rows = (query.data ?? []).filter((e) => !group || auditGroup(e.action) === group);

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Show"
        containerClassName="sm:max-w-xs"
        value={group ?? ""}
        options={[
          { value: "", label: "All activity" },
          ...AUDIT_GROUPS.map((g) => ({ value: g, label: auditGroupLabel[g] })),
        ]}
        onChange={(e) =>
          setParams(e.target.value ? { group: e.target.value } : {}, { replace: true })
        }
      />
      <DataTable
        key={group ?? "all"}
        caption="Audit log"
        columns={columns}
        data={rows}
        getRowId={(e) => e.id}
        initialSort={[{ id: "at", desc: true }]}
        pageSize={10}
        loading={query.isPending}
        error={
          query.isError ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : undefined
        }
        emptyState={
          <EmptyState
            icon={<ScrollText className="h-6 w-6" />}
            title="No activity"
            description={group ? "Nothing in this group yet." : "Actions will be recorded here."}
          />
        }
      />
      <LoadMore
        hasMore={query.hasNextPage}
        loading={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
        label="Load older entries"
      />
    </div>
  );
}
