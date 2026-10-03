import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { BacktestRunListItem } from "@nova/contracts";
import { Button, DataTable, Modal, Pager, Tabs } from "@nova/ui-core";
import { PnLText, formatPercent, formatQuantity } from "@nova/ui-trading";
import { useBacktests, usePageState, useStrategies } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatPeriod } from "../../lib/format";
import { RunFilters } from "../backtests/RunFilters.jsx";
import { EMPTY_FILTERS, toQuery } from "../backtests/runFilters";
import { MAX_RUNS } from "./compareMetrics";

export interface RunPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: string[];
  onApply: (ids: string[]) => void;
}

export function RunPickerDialog({ open, onOpenChange, selected, onApply }: RunPickerDialogProps) {
  const [draft, setDraft] = useState(selected);
  const [source, setSource] = useState("history");
  const [values, setValues] = useState({ ...EMPTY_FILTERS });
  const paging = usePageState(JSON.stringify([source, values]));
  const strategies = useStrategies();
  const query = useBacktests(
    {
      ...toQuery(values),
      status: "completed",
      dataSource: source === "recorded" ? "recorded" : "history",
    },
    paging,
  );
  const percent = (value: number | undefined) =>
    value === undefined ? "—" : formatPercent(value, { signed: true });
  const columns: ColumnDef<BacktestRunListItem, unknown>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      meta: { primary: true },
      cell: ({ row }) => `${row.original.name} · v${row.original.version}`,
    },
    {
      id: "strategy",
      header: "Strategy",
      meta: { hideOnMobile: true },
      cell: ({ row }) =>
        strategies.data?.find((s) => s.id === row.original.strategyId)?.name ??
        row.original.strategyId,
    },
    {
      id: "period",
      header: "Period",
      meta: { hideOnMobile: true },
      cell: ({ row }) => formatPeriod(row.original.from, row.original.to),
    },
    {
      id: "net",
      header: "Net P&L",
      meta: { numeric: true },
      cell: ({ row }) =>
        row.original.summary ? <PnLText paise={row.original.summary.netPnlPaise} /> : "—",
    },
    {
      id: "cagr",
      header: "CAGR",
      meta: { numeric: true },
      cell: ({ row }) => percent(row.original.summary?.cagrPercent),
    },
    {
      id: "drawdown",
      header: "Max DD",
      meta: { numeric: true },
      cell: ({ row }) => percent(row.original.summary?.maxDrawdownPercent),
    },
    {
      id: "winRate",
      header: "Win rate",
      meta: { numeric: true, hideOnMobile: true },
      cell: ({ row }) =>
        row.original.summary ? formatPercent(row.original.summary.winRatePercent) : "—",
    },
    {
      id: "trades",
      header: "Trades",
      meta: { numeric: true, hideOnMobile: true },
      cell: ({ row }) =>
        row.original.summary ? formatQuantity(row.original.summary.tradeCount) : "—",
    },
  ];
  const serverColumns = columns.map((column) => ({ ...column, enableSorting: false }));
  const list = (
    <div className="flex flex-col gap-4">
      <DataTable
        caption="Runs to compare"
        columns={serverColumns}
        data={query.data ?? []}
        getRowId={(run) => run.id}
        selectedIds={draft}
        onSelectedIdsChange={(ids) => setDraft(ids.slice(0, MAX_RUNS))}
        isRowSelectable={(run) => draft.includes(run.id) || draft.length < MAX_RUNS}
        loading={query.isPending}
        error={
          query.isError ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : undefined
        }
        emptyState="No completed runs match these filters"
      />
      <Pager
        page={paging.page}
        pageSize={paging.pageSize}
        total={query.total}
        onPageChange={paging.setPage}
        onPageSizeChange={paging.setPageSize}
        loading={query.isFetching}
      />
    </div>
  );
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Choose runs"
      description="Choose two or three completed runs. History and recorded runs may be compared together."
      footer={
        <>
          <span className="text-body-sm text-text-muted sm:mr-auto">
            {draft.length} of {MAX_RUNS} selected
          </span>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={draft.length < 2}
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Compare
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <RunFilters
          hideStatus
          strategies={strategies.data ?? []}
          values={values}
          onChange={(next) => {
            paging.setPage(1);
            setValues(next);
          }}
        />
        <Tabs
          ariaLabel="Compare data source"
          value={source}
          onValueChange={(next) => {
            paging.setPage(1);
            setSource(next);
          }}
          items={[
            { value: "history", label: "History data", content: list },
            { value: "recorded", label: "Recorded data", content: list },
          ]}
        />
      </div>
    </Modal>
  );
}
