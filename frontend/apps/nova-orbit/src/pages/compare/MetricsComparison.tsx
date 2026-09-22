import type { ColumnDef } from "@tanstack/react-table";
import type { BacktestMetrics } from "@nova/contracts";
import { Badge, DataTable } from "@nova/ui-core";
import { METRIC_ROWS, bestRunId, type MetricRow } from "./compareMetrics";

export interface ComparedRun {
  id: string;
  name: string;
  metrics: BacktestMetrics;
}

interface Row {
  metric: MetricRow;
  best: string | null;
}

/** One row per metric, one column per run; the best value is marked with a "Best" badge. */
export function MetricsComparison({ runs }: { runs: ComparedRun[] }) {
  const rows: Row[] = METRIC_ROWS.map((metric) => ({ metric, best: bestRunId(metric, runs) }));

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "metric",
      header: "Metric",
      accessorFn: (r) => r.metric.label,
      enableSorting: false,
      meta: { primary: true },
    },
    ...runs.map((run): ColumnDef<Row, unknown> => ({
      id: run.id,
      header: run.name,
      enableSorting: false,
      accessorFn: (r) => r.metric.format(run.metrics),
      meta: { numeric: true, mobileLabel: run.name },
      cell: ({ row }) => (
        <span className="inline-flex items-center justify-end gap-2">
          {row.original.best === run.id && <Badge tone="success">Best</Badge>}
          {row.original.metric.format(run.metrics)}
        </span>
      ),
    })),
  ];

  return (
    <DataTable
      caption="Metrics comparison"
      columns={columns}
      data={rows}
      getRowId={(r) => r.metric.key}
      pageSize={METRIC_ROWS.length}
    />
  );
}
