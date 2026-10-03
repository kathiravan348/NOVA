import type {
  BacktestRun,
  BacktestRunListItem,
  BacktestRunSummary,
  DataSource,
  StrategyStats,
} from "@nova/contracts";
import { mockBacktestResults, mockStrategies } from "../data";

type Metric = (s: BacktestRunSummary) => number | null;

/** The run's strategy version spec (mock runs always point at a known version). */
function specOf(run: BacktestRun) {
  const strategy = mockStrategies.find((s) => s.id === run.strategyId)!;
  return strategy.versions.find((v) => v.version === run.strategyVersion)!.spec;
}

function summaryOf(run: BacktestRun): BacktestRunSummary | null {
  const result = mockBacktestResults.find((r) => r.runId === run.id);
  if (run.status !== "completed" || !result) return null;
  const m = result.metrics;
  return {
    netPnlPaise: m.netPnlPaise,
    returnPercent: m.returnPercent,
    cagrPercent: m.cagrPercent,
    maxDrawdownPercent: m.maxDrawdownPercent,
    winRatePercent: m.winRatePercent,
    tradeCount: m.tradeCount,
    profitFactor: m.profitFactor ?? null,
    sharpe: m.sharpe,
    afterTaxCagrPercent: m.afterTaxCagrPercent ?? null,
    spreadCostPaise: m.spreadCostPaise ?? null,
  };
}

export function toListItem(run: BacktestRun): BacktestRunListItem {
  const spec = specOf(run);
  return { ...run, segment: spec.segment, timeframe: spec.timeframe, summary: summaryOf(run) };
}

const METRIC: Record<string, Metric> = {
  netPnl: (s) => s.netPnlPaise,
  return: (s) => s.returnPercent,
  cagr: (s) => s.cagrPercent,
  maxDrawdown: (s) => s.maxDrawdownPercent,
  winRate: (s) => s.winRatePercent,
  profitFactor: (s) => s.profitFactor,
  sharpe: (s) => s.sharpe,
  trades: (s) => s.tradeCount,
};
const SORTS = new Set(["created", ...Object.keys(METRIC)]);
const MINIMUMS: [string, Metric][] = [
  ["minReturn", (s) => s.returnPercent],
  ["minCagr", (s) => s.cagrPercent],
  ["minWinRate", (s) => s.winRatePercent],
  ["minTrades", (s) => s.tradeCount],
  ["minProfitFactor", (s) => s.profitFactor],
];
const EXACT: [string, (item: BacktestRunListItem) => string][] = [
  ["dataSource", (i) => i.dataSource],
  ["status", (i) => i.status],
  ["strategyId", (i) => i.strategyId],
  ["segment", (i) => i.segment],
  ["timeframe", (i) => i.timeframe],
];

const newest = (a: BacktestRunListItem, b: BacktestRunListItem) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

function keeps(
  item: BacktestRunListItem,
  params: URLSearchParams,
  numbers: Map<string, number>,
): boolean {
  if (EXACT.some(([key, get]) => params.has(key) && get(item) !== params.get(key))) return false;
  const q = params.get("q")?.toLowerCase();
  if (q && !item.name.toLowerCase().includes(q)) return false;
  const profitable = params.get("profitable");
  if (numbers.size === 0 && profitable === null) return true;
  const s = item.summary;
  if (!s) return false;
  for (const [key, get] of MINIMUMS) {
    const min = numbers.get(key);
    const value = get(s);
    if (min !== undefined && (value === null || value < min)) return false;
  }
  const drawdown = numbers.get("maxDrawdown");
  if (drawdown !== undefined && s.maxDrawdownPercent < -drawdown) return false;
  if (profitable === "true" && s.netPnlPaise <= 0) return false;
  if (profitable === "false" && s.netPnlPaise > 0) return false;
  return true;
}

/**
 * The same filters and sorts as the backend's `GET /backtests` (D82 (6)): an error message for a
 * bad parameter, else the matching rows in order.
 */
export function filterRuns(
  runs: BacktestRun[],
  params: URLSearchParams,
): BacktestRunListItem[] | string {
  const sort = params.get("sort") ?? "created";
  if (!SORTS.has(sort)) return `Unknown sort ${sort}`;
  if (sort !== "created" && params.has("cursor")) {
    return "A results sort pages by offset, not cursor";
  }
  const numbers = new Map<string, number>();
  for (const key of [...MINIMUMS.map(([k]) => k), "maxDrawdown"]) {
    const raw = params.get(key);
    if (raw === null) continue;
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value)) return `${key} must be a number`;
    numbers.set(key, value);
  }
  const rows = runs.map(toListItem).filter((item) => keeps(item, params, numbers));
  const descending = params.get("order") !== "asc";
  // Newest first keeps the mock file's order (screens and tests rely on it); ascending reverses it.
  if (sort === "created") return descending ? rows : rows.reverse();
  const get = METRIC[sort]!;
  return rows.sort((a, b) => {
    const x = a.summary ? get(a.summary) : null;
    const y = b.summary ? get(b.summary) : null;
    if (x === null || y === null) return x === y ? newest(a, b) : x === null ? 1 : -1;
    return (descending ? y - x : x - y) || newest(a, b);
  });
}

/** Strategy stats from one data source's runs (D82 (10)), worked out like the backend's SQL. */
export function statsFor(runs: BacktestRun[], source: DataSource): StrategyStats[] {
  return mockStrategies.map((strategy) => {
    const own = runs.filter((r) => r.strategyId === strategy.id && r.dataSource === source);
    const done = own.flatMap((run) => {
      const s = summaryOf(run);
      return s ? [{ run, s }] : [];
    });
    const pick = (f: (s: BacktestRunSummary) => number, best: boolean) =>
      done.length ? (best ? Math.max : Math.min)(...done.map((x) => f(x.s))) : null;
    const top = [...done].sort(
      (a, b) => b.s.netPnlPaise - a.s.netPnlPaise || a.run.id.localeCompare(b.run.id),
    )[0];
    return {
      strategyId: strategy.id,
      runsTotal: own.length,
      runsCompleted: own.filter((r) => r.status === "completed").length,
      runsFailed: own.filter((r) => r.status === "failed").length,
      runsInProgress: own.filter((r) => r.status === "queued" || r.status === "running").length,
      lastRunAt:
        own
          .map((r) => r.createdAt)
          .sort()
          .at(-1) ?? null,
      bestReturnPercent: pick((s) => s.returnPercent, true),
      worstReturnPercent: pick((s) => s.returnPercent, false),
      bestCagrPercent: pick((s) => s.cagrPercent, true),
      worstCagrPercent: pick((s) => s.cagrPercent, false),
      winRateMinPercent: pick((s) => s.winRatePercent, false),
      winRateMaxPercent: pick((s) => s.winRatePercent, true),
      worstDrawdownPercent: pick((s) => s.maxDrawdownPercent, false),
      bestNetPnl: top ? { runId: top.run.id, netPnlPaise: top.s.netPnlPaise } : null,
      byVersion: strategy.versions.map((v) => {
        const mine = done.filter((x) => x.run.strategyVersion === v.version);
        const best = [...mine].sort(
          (a, b) => b.s.returnPercent - a.s.returnPercent || a.run.id.localeCompare(b.run.id),
        )[0];
        return {
          version: v.version,
          runsCompleted: mine.length,
          bestReturnPercent: best ? best.s.returnPercent : null,
          bestRunId: best ? best.run.id : null,
        };
      }),
    };
  });
}
