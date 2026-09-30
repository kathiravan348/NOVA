import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { HardDrive } from "lucide-react";
import {
  MAX_DOWNLOAD_SYMBOLS,
  type CoverageQuery,
  type CoverageRow,
  type CoverageTimeframe,
} from "@nova/contracts";
import {
  Button,
  Card,
  Checkbox,
  DataTable,
  DateTimePicker,
  EmptyState,
  Input,
  Select,
  StatusBadge,
  Tabs,
  useToast,
} from "@nova/ui-core";
import { useCoverage } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { DATA_START_DAY, formatCalendarDate, todayIst } from "../../lib/format";
import {
  coverageGroups,
  needsDownload,
  statusLabel,
  statusTone,
  type GroupBy,
} from "./coverageGroups";
import { MissingDaysModal } from "./MissingDaysModal";
import { UnavailableDataPanel } from "./UnavailableDataPanel";
import { SyncToTodayButton } from "./SyncToTodayButton";

/** What New download starts with when opened from here (D63 (4)). */
export interface DownloadMissingState {
  symbols: string[];
  timeframe: CoverageTimeframe;
  from: string;
  to: string;
}

const dayOrDash = (day: string | null) => (day ? formatCalendarDate(day) : "—");

/** Stored history per stock and index, its gaps, grouped by index or sector (D63). */
export function StoredDataPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const today = todayIst();
  const [timeframe, setTimeframe] = useState<CoverageTimeframe>("1d");
  const [from, setFrom] = useState(DATA_START_DAY);
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState<GroupBy>("index");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [open, setOpen] = useState<CoverageRow | null>(null);
  const query: CoverageQuery = { timeframe, from, to };
  const coverage = useCoverage(query);

  const download = (rows: CoverageRow[]) => {
    const symbols = needsDownload(rows);
    if (symbols.length > MAX_DOWNLOAD_SYMBOLS) {
      toast.show({
        title: "Too many stocks",
        description: `Pick a smaller group: one download takes at most ${MAX_DOWNLOAD_SYMBOLS}.`,
        tone: "danger",
      });
      return;
    }
    const state: DownloadMissingState = { symbols, timeframe, from, to };
    void navigate("/data-jobs/new", { state });
  };

  const columns = useMemo<ColumnDef<CoverageRow, unknown>[]>(
    () => [
      {
        id: "symbol",
        header: "Symbol",
        accessorKey: "symbol",
        meta: { primary: true },
        cell: ({ row }) => (
          <button
            type="button"
            className="rounded-xs font-medium text-action hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
            onClick={() => setOpen(row.original)}
          >
            {row.original.symbol}
          </button>
        ),
      },
      { id: "name", header: "Name", accessorKey: "name", meta: { hideOnMobile: true } },
      {
        id: "first",
        header: "First day",
        accessorFn: (r) => r.firstDay ?? "",
        cell: ({ row }) => dayOrDash(row.original.firstDay),
      },
      {
        id: "last",
        header: "Last day",
        accessorFn: (r) => r.lastDay ?? "",
        cell: ({ row }) => dayOrDash(row.original.lastDay),
      },
      { id: "days", header: "Days", accessorKey: "days", meta: { numeric: true } },
      {
        id: "missing",
        header: "Missing days",
        accessorKey: "missingDays",
        meta: { numeric: true },
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <StatusBadge
            tone={statusTone[row.original.status]}
            label={statusLabel[row.original.status]}
          />
        ),
      },
      {
        id: "unavailable",
        header: "Unavailable days",
        accessorFn: (r) => r.unavailableDays ?? 0,
        meta: { numeric: true },
      },
    ],
    [],
  );

  const groups = coverageGroups(groupBy, download);
  const groupNames = [
    ...new Set((coverage.data?.rows ?? []).flatMap((r) => groups?.of(r) ?? [])),
  ].sort();
  const rows = (coverage.data?.rows ?? []).filter(
    (r) =>
      (!onlyGaps || r.status !== "complete") &&
      (!group || groups?.of(r).includes(group)) &&
      `${r.symbol} ${r.name}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const nothingStored = coverage.isSuccess && coverage.data.rows.every((r) => r.firstDay === null);

  return (
    <div className="flex flex-col gap-6">
      <SyncToTodayButton shown={rows} filtered={Boolean(group || search.trim() || onlyGaps)} />
      <Card title="What to check">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Timeframe"
            description="3m to 1h are built from 1m"
            options={[
              { value: "1d", label: "Daily (1d)" },
              { value: "1m", label: "1 minute (1m)" },
            ]}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as CoverageTimeframe)}
          />
          <DateTimePicker
            mode="date"
            label="From"
            max={to}
            value={from}
            onChange={(v) => v && setFrom(v)}
          />
          <DateTimePicker
            mode="date"
            label="To"
            max={today}
            value={to}
            onChange={(v) => v && setTo(v)}
          />
          <Select
            label="Group by"
            options={[
              { value: "none", label: "None" },
              { value: "index", label: "Index" },
              { value: "sector", label: "Sector" },
            ]}
            value={groupBy}
            onChange={(e) => {
              setGroupBy(e.target.value as GroupBy);
              setGroup("");
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Checkbox
            label="Only with gaps"
            checked={onlyGaps}
            onCheckedChange={(on) => setOnlyGaps(on === true)}
          />
          {coverage.data && (
            <p className="text-body-sm text-text-muted">
              {coverage.data.calendar === "index"
                ? "Observed trading days from NIFTY 50 and dates with at least 10 stocks."
                : "Observed trading days from dates with at least 10 stocks."}
              {
                " Holidays and weekends without observed sessions are excluded; observed special sessions count. Dates absent from all data are unknown, not confirmed holidays."
              }
            </p>
          )}
        </div>
      </Card>
      <Tabs
        ariaLabel="Stored data views"
        items={[
          {
            value: "coverage",
            label: "Coverage",
            content: nothingStored ? (
              <EmptyState
                icon={<HardDrive className="h-6 w-6" />}
                title="No prices stored yet"
                description="Download prices first, then come back to check them."
                action={
                  <Button asChild>
                    <Link to="/data-jobs/new">New download</Link>
                  </Button>
                }
              />
            ) : (
              <DataTable<CoverageRow>
                caption="Stored data"
                columns={columns}
                data={rows}
                getRowId={(r) => r.symbol}
                loading={coverage.isPending}
                error={
                  coverage.isError ? (
                    <QueryError error={coverage.error} onRetry={() => void coverage.refetch()} />
                  ) : undefined
                }
                toolbar={
                  <>
                    <Input
                      type="search"
                      label="Search stocks"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {groups && (
                      <Select
                        label="Show group"
                        value={group}
                        onChange={(e) => setGroup(e.target.value)}
                        options={[
                          { value: "", label: "All groups" },
                          ...groupNames.map((value) => ({ value, label: value })),
                        ]}
                      />
                    )}
                  </>
                }
                groups={groups}
                pageSize={25}
                initialSort={[{ id: "symbol", desc: false }]}
                emptyState={onlyGaps ? "Nothing is missing in this period." : "No stocks to show"}
              />
            ),
          },
          {
            value: "unavailable",
            label: "Unavailable data",
            content: <UnavailableDataPanel query={query} />,
          },
        ]}
      />
      <MissingDaysModal
        row={open}
        query={query}
        onClose={() => setOpen(null)}
        onDownload={download}
      />
    </div>
  );
}
