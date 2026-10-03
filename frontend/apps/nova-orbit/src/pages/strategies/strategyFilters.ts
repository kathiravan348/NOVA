import {
  DataSourceSchema,
  SegmentSchema,
  StrategyStatusSchema,
  StrategyTimeframeSchema,
  type DataSource,
  type Segment,
  type Strategy,
  type StrategyStats,
  type StrategyStatus,
  type StrategyTimeframe,
} from "@nova/contracts";

export type SortKey = "updated" | "best" | "runs" | "name" | "net" | "drawdown";
export interface StrategyFilterValues {
  q: string;
  status: StrategyStatus | "all";
  dataSource: DataSource | "all";
  sort: SortKey;
  mode: "all" | "visual" | "python" | "rotation" | "intraday";
  segment: Segment | "all";
  timeframe: StrategyTimeframe | "all";
  tested: "all" | "tested" | "untested";
  minBestCagr: string;
}

export const EMPTY_FILTERS: StrategyFilterValues = {
  q: "",
  status: "all",
  dataSource: "all",
  sort: "updated",
  mode: "all",
  segment: "all",
  timeframe: "all",
  tested: "all",
  minBestCagr: "",
};
export const SORT_LABELS: Record<SortKey, string> = {
  updated: "Recently updated",
  best: "Best CAGR",
  runs: "Most runs",
  name: "Name (A–Z)",
  net: "Best net P&L",
  drawdown: "Smallest drawdown",
};
const MODES = ["all", "visual", "python", "rotation", "intraday"] as const;
const TESTED = ["all", "tested", "untested"] as const;

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value !== null && options.includes(value as T) ? (value as T) : fallback;
}

export function minCagrValue(value: string): number | undefined {
  return value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : undefined;
}

export function fromQuery(params: URLSearchParams): StrategyFilterValues {
  const minimum = params.get("minBestCagr") ?? "";
  return {
    q: (params.get("q") ?? "").slice(0, 200),
    status: pick(params.get("status"), ["all", ...StrategyStatusSchema.options], "all"),
    dataSource: pick(params.get("dataSource"), ["all", ...DataSourceSchema.options], "all"),
    sort: pick(params.get("sort"), Object.keys(SORT_LABELS) as SortKey[], "updated"),
    mode: pick(params.get("mode"), MODES, "all"),
    segment: pick(params.get("segment"), ["all", ...SegmentSchema.options], "all"),
    timeframe: pick(params.get("timeframe"), ["all", ...StrategyTimeframeSchema.options], "all"),
    tested: pick(params.get("tested"), TESTED, "all"),
    minBestCagr: minCagrValue(minimum) === undefined ? "" : minimum.trim(),
  };
}

export function toQuery(values: StrategyFilterValues): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of Object.keys(EMPTY_FILTERS) as (keyof StrategyFilterValues)[]) {
    const value = values[key];
    if (value === EMPTY_FILTERS[key]) continue;
    if (key === "minBestCagr" && minCagrValue(value) === undefined) continue;
    params.set(key, key === "q" ? value.slice(0, 200) : value);
  }
  return params;
}

export function hasFilters(values: StrategyFilterValues): boolean {
  return Object.keys(EMPTY_FILTERS).some(
    (key) =>
      values[key as keyof StrategyFilterValues] !==
      EMPTY_FILTERS[key as keyof StrategyFilterValues],
  );
}

export function hasMoreFilters(values: StrategyFilterValues): boolean {
  return (
    values.mode !== "all" ||
    values.segment !== "all" ||
    values.timeframe !== "all" ||
    values.tested !== "all" ||
    values.minBestCagr !== ""
  );
}

export function filterStrategies(
  list: Strategy[],
  statsById: ReadonlyMap<string, StrategyStats>,
  values: StrategyFilterValues,
): Strategy[] {
  const needle = values.q.trim().toLowerCase();
  const minimum = minCagrValue(values.minBestCagr);
  return list.filter((strategy) => {
    const spec = strategy.versions.find(
      (version) => version.version === strategy.latestVersion,
    )?.spec;
    if (!spec || !strategy.name.toLowerCase().includes(needle)) return false;
    if (values.status !== "all" && strategy.status !== values.status) return false;
    if (values.mode !== "all" && spec.mode !== values.mode) return false;
    if (values.segment !== "all" && spec.segment !== values.segment) return false;
    if (values.timeframe !== "all" && spec.timeframe !== values.timeframe) return false;
    const stats = statsById.get(strategy.id);
    const tested = (stats?.runsCompleted ?? 0) > 0;
    if (values.tested === "tested" && !tested) return false;
    if (values.tested === "untested" && tested) return false;
    return (
      minimum === undefined || (stats?.bestCagrPercent != null && stats.bestCagrPercent >= minimum)
    );
  });
}

/** Results with no completed run sort last; ties go newest first, then by id. */
export function sortStrategies(
  list: Strategy[],
  statsById: ReadonlyMap<string, StrategyStats>,
  sort: SortKey,
): Strategy[] {
  const metric = (strategy: Strategy) => {
    const stats = statsById.get(strategy.id);
    if (sort === "best") return stats?.bestCagrPercent ?? -Infinity;
    if (sort === "runs") return stats?.runsTotal ?? 0;
    if (sort === "net") return stats?.bestNetPnl?.netPnlPaise ?? -Infinity;
    return stats?.worstDrawdownPercent ?? -Infinity;
  };
  return [...list].sort((a, b) => {
    if (sort === "name") {
      const name = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
      if (name !== 0) return name;
    } else if (sort !== "updated" && metric(a) !== metric(b)) {
      return metric(b) > metric(a) ? 1 : -1;
    }
    return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
  });
}
