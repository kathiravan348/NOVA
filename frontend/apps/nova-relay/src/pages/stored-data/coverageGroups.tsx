import { Download } from "lucide-react";
import type { CoverageRow, CoverageStatus } from "@nova/contracts";
import { Button, type DataTableGroups } from "@nova/ui-core";

export type GroupBy = "none" | "index" | "sector";

export const statusLabel: Record<CoverageStatus, string> = {
  complete: "Complete",
  gaps: "Gaps",
  partial: "Partial",
  none: "No data",
  unavailable: "Broker unavailable",
};

export const statusTone: Record<CoverageStatus, "success" | "warning" | "info" | "neutral"> = {
  complete: "success",
  gaps: "warning",
  partial: "info",
  none: "neutral",
  unavailable: "warning",
};

/** Stocks that still need prices: anything not complete (D63). */
export const needsDownload = (rows: CoverageRow[]) =>
  rows.filter((r) => r.status !== "complete" && r.status !== "unavailable").map((r) => r.symbol);

const count = (rows: CoverageRow[], status: CoverageStatus) =>
  rows.filter((r) => r.status === status).length;

/** "99 stocks · 97 complete · 2 with gaps · 0 no data · 5 missing days" */
export function groupSummary(rows: CoverageRow[]): string {
  const missing = rows.reduce((sum, r) => sum + r.missingDays, 0);
  const stocks = `${rows.length} ${rows.length === 1 ? "stock" : "stocks"}`;
  return [
    stocks,
    `${count(rows, "complete")} complete`,
    `${count(rows, "gaps")} with gaps`,
    `${count(rows, "partial")} partial`,
    `${count(rows, "none")} no data`,
    ...(count(rows, "unavailable") ? [`${count(rows, "unavailable")} broker unavailable`] : []),
    `${missing.toLocaleString("en-IN")} missing days`,
    ...(rows.some((r) => r.unavailableDays)
      ? [
          `${rows.reduce((sum, r) => sum + (r.unavailableDays ?? 0), 0).toLocaleString("en-IN")} unavailable days`,
        ]
      : []),
  ].join(" · ");
}

/** Group by index (a stock is under each of its indices; indices under "Indices") or by sector. */
export function coverageGroups(
  by: GroupBy,
  onDownload: (rows: CoverageRow[]) => void,
): DataTableGroups<CoverageRow> | undefined {
  if (by === "none") return undefined;
  return {
    of: (row) =>
      by === "sector"
        ? [row.sector]
        : row.kind === "index"
          ? ["Indices"]
          : row.indices.length > 0
            ? row.indices
            : ["Non-index stocks"],
    order: (a, b) => {
      const rank = (key: string) =>
        by === "index"
          ? key === "Indices"
            ? -1
            : key === "Non-index stocks"
              ? 1
              : 0
          : key === "Unclassified"
            ? 1
            : 0;
      return rank(a) - rank(b) || a.localeCompare(b);
    },
    summary: (_, rows) => groupSummary(rows),
    actions: (key, rows) =>
      needsDownload(rows).length > 0 ? (
        <Button size="sm" variant="secondary" onClick={() => onDownload(rows)}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Download missing
          <span className="sr-only"> for {key}</span>
        </Button>
      ) : null,
  };
}
