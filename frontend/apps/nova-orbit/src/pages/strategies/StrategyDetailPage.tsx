import { useParams } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { Strategy, StrategyVersion } from "@nova/contracts";
import { Card, DataTable, StatusBadge, Tabs } from "@nova/ui-core";
import { useStrategy } from "@nova/services";
import { QueryState } from "../../components/QueryState";
import { formatIstDateTime, strategyStatusLabel, strategyStatusTone } from "../../lib/format";
import { StrategySpecCard } from "./StrategySpecCard";

const versionColumns: ColumnDef<StrategyVersion, unknown>[] = [
  {
    id: "version",
    header: "Version",
    accessorKey: "version",
    meta: { numeric: true, primary: true },
    cell: ({ getValue }) => `v${String(getValue())}`,
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
];

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
          </div>
          <p className="text-body text-text-secondary">{strategy.description}</p>
          <p className="text-body-sm text-text-muted">
            Updated {formatIstDateTime(strategy.updatedAt)}
          </p>
        </div>
      </Card>
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
            value: "versions",
            label: `Versions (${strategy.versions.length})`,
            content: (
              <DataTable
                caption="Versions"
                columns={versionColumns}
                data={strategy.versions}
                getRowId={(v) => String(v.version)}
                initialSort={[{ id: "version", desc: true }]}
              />
            ),
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
