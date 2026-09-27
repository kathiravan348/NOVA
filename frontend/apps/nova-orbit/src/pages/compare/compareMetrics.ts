import type { BacktestMetrics } from "@nova/contracts";
import { formatInr, formatPercent } from "@nova/ui-trading";

export const MAX_RUNS = 3;

const orDash = (value: number | null | undefined, show: (v: number) => string) =>
  value === null || value === undefined ? "—" : show(value);

export interface MetricRow {
  key: string;
  label: string;
  /** null: the run has no such number (older runs, D62); never ranked. */
  value: (m: BacktestMetrics) => number | null;
  format: (m: BacktestMetrics) => string;
  /** Which direction is better; null = not ranked. */
  better: "higher" | "lower" | null;
}

export const METRIC_ROWS: MetricRow[] = [
  {
    key: "net",
    label: "Net P&L",
    value: (m) => m.netPnlPaise,
    format: (m) => formatInr(m.netPnlPaise, { signed: true }),
    better: "higher",
  },
  {
    key: "return",
    label: "Return",
    value: (m) => m.returnPercent,
    format: (m) => formatPercent(m.returnPercent, { signed: true }),
    better: "higher",
  },
  {
    key: "cagr",
    label: "CAGR",
    value: (m) => m.cagrPercent,
    format: (m) => formatPercent(m.cagrPercent, { signed: true }),
    better: "higher",
  },
  {
    key: "afterTaxCagr",
    label: "After-tax CAGR",
    value: (m) => m.afterTaxCagrPercent ?? null,
    format: (m) => orDash(m.afterTaxCagrPercent, (v) => formatPercent(v, { signed: true })),
    better: "higher",
  },
  {
    key: "benchmark",
    label: "Benchmark return",
    value: (m) => m.benchmarkReturnPercent ?? null,
    format: (m) => orDash(m.benchmarkReturnPercent, (v) => formatPercent(v, { signed: true })),
    better: null,
  },
  {
    key: "drawdown",
    label: "Max drawdown",
    value: (m) => m.maxDrawdownPercent,
    format: (m) => formatPercent(m.maxDrawdownPercent),
    // Drawdowns are ≤ 0, so the higher (closer to zero) one is better.
    better: "higher",
  },
  {
    key: "sharpe",
    label: "Sharpe",
    value: (m) => m.sharpe,
    format: (m) => m.sharpe.toFixed(2),
    better: "higher",
  },
  {
    key: "profitFactor",
    label: "Profit factor",
    value: (m) => m.profitFactor ?? null,
    format: (m) => orDash(m.profitFactor, (v) => v.toFixed(2)),
    better: "higher",
  },
  {
    key: "calmar",
    label: "Calmar",
    value: (m) => m.calmar ?? null,
    format: (m) => orDash(m.calmar, (v) => v.toFixed(2)),
    better: "higher",
  },
  {
    key: "winRate",
    label: "Win rate",
    value: (m) => m.winRatePercent,
    format: (m) => formatPercent(m.winRatePercent, { decimals: 0 }),
    better: "higher",
  },
  {
    key: "trades",
    label: "Trades",
    value: (m) => m.tradeCount,
    format: (m) => String(m.tradeCount),
    better: null,
  },
  {
    key: "charges",
    label: "Charges",
    value: (m) => m.chargesPaise,
    format: (m) => formatInr(m.chargesPaise),
    better: "lower",
  },
];

/** `?runs=a,b,a,c,d` → `["a","b","c"]` (unique, at most 3). */
export function parseRunIds(search: string | null): string[] {
  if (!search) return [];
  return [
    ...new Set(
      search
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_RUNS);
}

export const toSearch = (ids: string[]) => ids.join(",");

/** Id of the single best run for a row, or null when unranked, tied or a value is missing. */
export function bestRunId(
  row: MetricRow,
  runs: { id: string; metrics: BacktestMetrics }[],
): string | null {
  if (!row.better || runs.length < 2) return null;
  const values = runs.map((run) => ({ id: run.id, value: row.value(run.metrics) }));
  const known = values.filter((v): v is { id: string; value: number } => v.value !== null);
  if (known.length < values.length) return null;
  const sign = row.better === "higher" ? 1 : -1;
  const sorted = [...known].sort((a, b) => sign * (b.value - a.value));
  const [first, second] = sorted;
  if (!first || !second || first.value === second.value) return null;
  return first.id;
}
