import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3, GitCompare, Pencil, Play } from "lucide-react";
import type { Strategy, StrategyVersion } from "@nova/contracts";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Skeleton,
  StatusBadge,
  Tabs,
  LoadMore,
} from "@nova/ui-core";
import { StrategyStatsList } from "@nova/ui-trading";
import { useBacktests, useStrategy, useStrategyStats } from "@nova/services";
import { QueryError, QueryState } from "../../components/QueryState";
import {
  formatIstDate,
  formatIstDateTime,
  strategyStatusLabel,
  strategyStatusTone,
} from "../../lib/format";
import { useRunColumns } from "../backtests/runColumns";
import { DeleteStrategyButton } from "./DeleteStrategyButton";
import { StrategySpecCard } from "./StrategySpecCard";
import { VersionRecord, useVersionStats } from "./StrategyVersionPage";

const versionColumns = (
  strategyId: string,
  records: ReturnType<typeof useVersionStats>,
): ColumnDef<StrategyVersion, unknown>[] => [
  {
    id: "version",
    header: "Version",
    accessorKey: "version",
    meta: { numeric: true, primary: true },
    cell: ({ row }) => (
      <Link
        to={`/strategies/${strategyId}/versions/${row.original.version}`}
        className="font-medium text-action-text hover:underline"
      >
        v{row.original.version}
      </Link>
    ),
  },
  {
    id: "createdAt",
    header: "Created",
    accessorKey: "createdAt",
    meta: { numeric: true },
    cell: ({ getValue }) => formatIstDateTime(getValue() as string),
  },
  {
    id: "mode",
    header: "Mode",
    accessorFn: (v) => (v.spec.mode === "visual" ? "Visual" : "Python"),
  },
  { id: "note", header: "Note", accessorKey: "note" },
  {
    id: "record",
    header: "Backtests",
    enableSorting: false,
    cell: ({ row }) => <VersionRecord stats={records.get(row.original.version)} />,
  },
];

/** Every version: open one, or tick two and compare them side by side (D60). */
function StrategyVersions({ strategy }: { strategy: Strategy }) {
  const navigate = useNavigate();
  const records = useVersionStats(strategy.id);
  const [picked, setPicked] = useState<string[]>([]);
  const two = picked.length === 2;
  return (
    <DataTable
      caption="Versions"
      columns={versionColumns(strategy.id, records)}
      data={strategy.versions}
      getRowId={(v) => String(v.version)}
      initialSort={[{ id: "version", desc: true }]}
      selectedIds={picked}
      onSelectedIdsChange={(ids) => setPicked(ids.slice(-2))}
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            disabled={!two}
            onClick={() => {
              const [a, b] = [...picked].map(Number).sort((x, y) => x - y);
              navigate(`/strategies/${strategy.id}/compare?a=${a}&b=${b}`);
            }}
          >
            <GitCompare className="h-4 w-4" aria-hidden="true" />
            Compare versions
          </Button>
          {!two && (
            <span className="text-body-sm text-text-muted">Tick two versions to compare.</span>
          )}
        </div>
      }
    />
  );
}

function StatsCard({ strategyId }: { strategyId: string }) {
  const query = useStrategyStats();
  const stats = query.data?.find((s) => s.strategyId === strategyId);
  return (
    <Card title="Backtest stats">
      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : stats ? (
        <StrategyStatsList
          stats={stats}
          lastRunLabel={stats.lastRunAt ? formatIstDate(stats.lastRunAt) : undefined}
          renderBestRun={(content, runId) => (
            <Link to={`/backtests/${runId}`} className="hover:underline">
              {content}
            </Link>
          )}
        />
      ) : (
        <p className="text-body-sm text-text-muted">No backtests yet.</p>
      )}
    </Card>
  );
}

function StrategyRuns({ strategyId }: { strategyId: string }) {
  const query = useBacktests({ strategyId });
  const columns = useRunColumns({ withStrategy: false });
  return (
    <div className="flex flex-col gap-4">
      <DataTable
        caption="Backtests of this strategy"
        columns={columns}
        data={query.data ?? []}
        getRowId={(r) => r.id}
        initialSort={[{ id: "createdAt", desc: true }]}
        loading={query.isPending}
        error={
          query.isError ? (
            <QueryError error={query.error} onRetry={() => void query.refetch()} />
          ) : undefined
        }
        emptyState={
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title="No backtests yet"
            description="Run a backtest to see it here."
          />
        }
      />
      <LoadMore
        hasMore={query.hasNextPage}
        loading={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </div>
  );
}

function StrategyDetail({ strategy }: { strategy: Strategy }) {
  const latest = strategy.versions.find((v) => v.version === strategy.latestVersion)!;
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-page-title text-text-primary">{strategy.name}</h2>
            <StatusBadge
              tone={strategyStatusTone[strategy.status]}
              label={strategyStatusLabel[strategy.status]}
            />
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button asChild variant="secondary" size="sm">
                <Link to={`/strategies/${strategy.id}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Link>
              </Button>
              {strategy.status !== "archived" && (
                <Button asChild size="sm">
                  <Link to={`/backtests/new?strategy=${strategy.id}`}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Run backtest
                  </Link>
                </Button>
              )}
              <DeleteStrategyButton strategyId={strategy.id} name={strategy.name} />
            </div>
          </div>
          <p className="text-body text-text-secondary">{strategy.description}</p>
          <p className="text-body-sm text-text-muted">
            Updated {formatIstDateTime(strategy.updatedAt)}
          </p>
        </div>
      </Card>
      <StatsCard strategyId={strategy.id} />
      <Tabs
        ariaLabel="Strategy sections"
        defaultValue="spec"
        items={[
          {
            value: "spec",
            label: "Specification",
            content: <StrategySpecCard spec={latest.spec} version={latest.version} />,
          },
          {
            value: "backtests",
            label: "Backtests",
            content: <StrategyRuns strategyId={strategy.id} />,
          },
          {
            value: "versions",
            label: `Versions (${strategy.versions.length})`,
            content: <StrategyVersions strategy={strategy} />,
          },
        ]}
      />
    </div>
  );
}

export function StrategyDetailPage() {
  const { id = "" } = useParams();
  const query = useStrategy(id);
  return (
    <QueryState query={query} back={{ to: "/strategies", label: "Back to strategies" }}>
      {(strategy) => <StrategyDetail strategy={strategy} />}
    </QueryState>
  );
}
