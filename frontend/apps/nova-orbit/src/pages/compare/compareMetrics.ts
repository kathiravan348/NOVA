import type { BacktestMetrics } from "@nova/contracts";
import { formatInr, formatPercent } from "@nova/ui-trading";

export const MAX_RUNS = 3;

export interface MetricRow {
  key: string;
  label: string;
  value: (m: BacktestMetrics) => number;
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

/** Id of the single best run for a row, or null when unranked or tied. */
export function bestRunId(
  row: MetricRow,
  runs: { id: string; metrics: BacktestMetrics }[],
): string | null {
  if (!row.better || runs.length < 2) return null;
  const sign = row.better === "higher" ? 1 : -1;
  const sorted = [...runs].sort((a, b) => sign * (row.value(b.metrics) - row.value(a.metrics)));
  const [first, second] = sorted;
  if (!first || !second || row.value(first.metrics) === row.value(second.metrics)) return null;
  return first.id;
}
