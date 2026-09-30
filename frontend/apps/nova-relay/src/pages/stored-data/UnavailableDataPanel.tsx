import { usePageState } from "@nova/services";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { CoverageQuery, UnavailableDay, UnavailableQuery } from "@nova/contracts";
import { Button, Card, DataTable, Input, Pager, Select, StatusBadge } from "@nova/ui-core";
import type { ColumnDef } from "@tanstack/react-table";
import { useUnavailableDays } from "@nova/services";
import { QueryError } from "../../components/QueryState";

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});
const checkFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export function UnavailableDataPanel({ query }: { query: CoverageQuery }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<NonNullable<UnavailableQuery["status"]>>("unavailable");
  const [search, setSearch] = useState("");
  const paging = usePageState(JSON.stringify({ ...query, status, search }));
  const history = useUnavailableDays({ ...query, status }, paging);
  const recheck = (row: UnavailableDay) => {
    void navigate("/data-jobs/new", {
      state: {
        symbols: [row.symbol],
        timeframe: row.timeframe,
        from: row.day,
        to: row.day,
        mode: "overwrite",
      },
    });
  };
  const columns: ColumnDef<UnavailableDay>[] = [
    { id: "symbol", header: "Symbol", accessorKey: "symbol", meta: { primary: true } },
    {
      id: "day",
      header: "Unavailable date",
      accessorKey: "day",
      cell: ({ row }) => dayFormat.format(new Date(`${row.original.day}T00:00:00+05:30`)),
    },
    { id: "timeframe", header: "Timeframe", accessorKey: "timeframe" },
    { id: "broker", header: "Broker", accessorKey: "broker" },
    { id: "reason", header: "Response", cell: () => "No usable candle returned" },
    {
      id: "firstCheckedAt",
      header: "First checked",
      accessorKey: "firstCheckedAt",
      meta: { hideOnMobile: true },
      cell: ({ row }) => `${checkFormat.format(new Date(row.original.firstCheckedAt))} IST`,
    },
    {
      id: "lastCheckedAt",
      header: "Last checked",
      accessorKey: "lastCheckedAt",
      cell: ({ row }) => `${checkFormat.format(new Date(row.original.lastCheckedAt))} IST`,
    },
    { id: "attempts", header: "Checks", accessorKey: "attempts", meta: { numeric: true } },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          tone={row.original.status === "resolved" ? "success" : "warning"}
          label={row.original.status === "resolved" ? "Resolved" : "Broker unavailable"}
        />
      ),
    },
    {
      id: "job",
      header: "Last job",
      cell: ({ row }) =>
        row.original.lastJobId ? (
          <Link
            className="text-action-text hover:underline"
            to={`/data-jobs/${row.original.lastJobId}`}
          >
            View job
          </Link>
        ) : (
          "—"
        ),
    },
    {
      id: "check",
      header: "Recheck",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => recheck(row.original)}
          aria-label={`Check ${row.original.symbol} ${row.original.day} again`}
        >
          Check again
        </Button>
      ),
    },
  ];
  const rows = history.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Card title="Unavailable data">
      <div className="flex flex-col gap-4">
        <p className="text-body-sm text-text-muted">
          These trading dates still have no usable candle after a successful broker response. This
          records what the broker returned; it does not confirm why the data is absent. Routine
          downloads skip recorded dates. Check again opens an overwrite download plan; recovered
          dates move to Resolved automatically.
        </p>
        <Select
          label="Availability"
          value={status}
          onChange={(e) => setStatus(e.target.value as NonNullable<UnavailableQuery["status"]>)}
          options={[
            { value: "unavailable", label: "Broker unavailable" },
            { value: "resolved", label: "Resolved" },
            { value: "all", label: "All history" },
          ]}
        />
        <DataTable
          caption="Unavailable data"
          columns={columns}
          data={rows.filter((row) =>
            `${row.symbol} ${row.day} ${row.broker}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
          )}
          getRowId={(row) => row.id}
          loading={history.isPending}
          toolbar={
            <Input
              type="search"
              label="Search unavailable dates"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          }
          emptyState="No broker-unavailable dates recorded for these filters."
          error={
            history.isError ? (
              <QueryError error={history.error} onRetry={() => void history.refetch()} />
            ) : undefined
          }
        />
        <Pager
          page={paging.page}
          pageSize={paging.pageSize}
          total={history.data?.pages[0]?.total ?? 0}
          onPageChange={paging.setPage}
          onPageSizeChange={paging.setPageSize}
          loading={history.isFetching}
        />
      </div>
    </Card>
  );
}
