import { Link } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound } from "lucide-react";
import type { BrokerAccount } from "@nova/contracts";
import { Badge, DataTable, EmptyState, StatusBadge } from "@nova/ui-core";
import { useBrokerAccounts } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatIstShort } from "../../lib/format";
import { brokerLabel, sessionLabel, sessionTone } from "../../lib/session";

const columns: ColumnDef<BrokerAccount, unknown>[] = [
  {
    id: "label",
    header: "Account",
    accessorKey: "label",
    meta: { primary: true },
    cell: ({ row }) => (
      <Link
        to={`/accounts/${row.original.id}`}
        className="font-medium text-action-text hover:underline"
      >
        {row.original.label}
      </Link>
    ),
  },
  {
    id: "clientId",
    header: "Client ID",
    accessorKey: "clientId",
    cell: ({ getValue }) => <span className="font-mono">{getValue() as string}</span>,
  },
  {
    id: "broker",
    header: "Broker",
    accessorFn: (a) => brokerLabel[a.broker],
    meta: { hideOnMobile: true },
  },
  {
    id: "enabled",
    header: "Status",
    accessorKey: "enabled",
    cell: ({ getValue }) =>
      getValue() ? <Badge tone="success">Enabled</Badge> : <Badge>Disabled</Badge>,
  },
  {
    id: "session",
    header: "Session",
    accessorFn: (a) => a.session.status,
    cell: ({ row }) => (
      <StatusBadge
        tone={sessionTone[row.original.session.status]}
        label={sessionLabel[row.original.session.status]}
      />
    ),
  },
  {
    id: "expires",
    header: "Expires",
    accessorFn: (a) => a.session.expiresAt ?? "",
    meta: { numeric: true },
    cell: ({ row }) =>
      row.original.session.expiresAt ? formatIstShort(row.original.session.expiresAt) : "—",
  },
];

export function AccountsPage() {
  const query = useBrokerAccounts();
  return (
    <DataTable
      caption="Broker accounts"
      columns={columns}
      data={query.data ?? []}
      getRowId={(a) => a.id}
      loading={query.isPending}
      error={
        query.isError ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : undefined
      }
      emptyState={
        <EmptyState
          icon={<KeyRound className="h-6 w-6" />}
          title="No broker accounts"
          description="Accounts are added in Stage B."
        />
      }
    />
  );
}
