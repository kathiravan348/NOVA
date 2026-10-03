import {
  BacktestListSortSchema,
  BacktestRunStatusSchema,
  SegmentSchema,
  StrategyTimeframeSchema,
  type BacktestListSort,
} from "@nova/contracts";
import type { BacktestFilter } from "@nova/services";

/** The Backtests filter bar (D82 (6)); every value is text as typed, "" = not set. */
export interface RunFilterValues {
  q: string;
  strategyId: string;
  status: string;
  sort: BacktestListSort;
  ascending: boolean;
  segment: string;
  timeframe: string;
  profitable: boolean;
  minReturn: string;
  minCagr: string;
  maxDrawdown: string;
  minWinRate: string;
  minTrades: string;
  minProfitFactor: string;
}

export const EMPTY_FILTERS: RunFilterValues = {
  q: "",
  strategyId: "",
  status: "",
  sort: "created",
  ascending: false,
  segment: "",
  timeframe: "",
  profitable: false,
  minReturn: "",
  minCagr: "",
  maxDrawdown: "",
  minWinRate: "",
  minTrades: "",
  minProfitFactor: "",
};

export const SORT_LABELS: Record<BacktestListSort, string> = {
  created: "Newest",
  netPnl: "Net P&L",
  return: "Return",
  cagr: "CAGR",
  maxDrawdown: "Max drawdown",
  winRate: "Win rate",
  profitFactor: "Profit factor",
  sharpe: "Sharpe",
  trades: "Trades",
};

type NumberKey =
  "minReturn" | "minCagr" | "maxDrawdown" | "minWinRate" | "minTrades" | "minProfitFactor";

/** Bounds of each number filter (the API's): [min, max, whole numbers only]. */
export const NUMBER_RULES: Record<NumberKey, [number, number, boolean]> = {
  minReturn: [-Infinity, Infinity, false],
  minCagr: [-Infinity, Infinity, false],
  maxDrawdown: [0, 100, false],
  minWinRate: [0, 100, false],
  minTrades: [0, Infinity, true],
  minProfitFactor: [0, Infinity, false],
};
const NUMBER_KEYS = Object.keys(NUMBER_RULES) as NumberKey[];
/** Filters kept under **More filters**. */
const MORE_KEYS = ["segment", "timeframe", "profitable", ...NUMBER_KEYS] as const;

/** A number filter's value, or undefined when it is empty or out of bounds. */
export function numberValue(key: NumberKey, text: string): number | undefined {
  if (text.trim() === "") return undefined;
  const value = Number(text);
  const [min, max, whole] = NUMBER_RULES[key];
  if (!Number.isFinite(value) || value < min || value > max) return undefined;
  if (whole && !Number.isInteger(value)) return undefined;
  return value;
}

const valid = (ok: boolean, text: string) => (ok ? text : "");

/** Values from the page URL; unknown or bad parameters are dropped. */
export function fromParams(params: URLSearchParams): RunFilterValues {
  const get = (key: string) => params.get(key) ?? "";
  const sort = BacktestListSortSchema.safeParse(get("sort"));
  const values: RunFilterValues = {
    ...EMPTY_FILTERS,
    q: get("q").slice(0, 200),
    strategyId: get("strategyId"),
    status: valid(BacktestRunStatusSchema.safeParse(get("status")).success, get("status")),
    sort: sort.success ? sort.data : "created",
    ascending: get("order") === "asc",
    segment: valid(SegmentSchema.safeParse(get("segment")).success, get("segment")),
    timeframe: valid(StrategyTimeframeSchema.safeParse(get("timeframe")).success, get("timeframe")),
    profitable: get("profitable") === "true",
  };
  for (const key of NUMBER_KEYS) {
    values[key] = numberValue(key, get(key)) === undefined ? "" : get(key);
  }
  return values;
}

/** URL parameters for `values`, keeping `keep` (e.g. the tab's `source`); empty ones are left out. */
export function toParams(values: RunFilterValues, keep: Record<string, string> = {}) {
  const params = new URLSearchParams(keep);
  const text: [string, string][] = [
    ["q", values.q.trim()],
    ["strategyId", values.strategyId],
    ["status", values.status],
    ["segment", values.segment],
    ["timeframe", values.timeframe],
    ...NUMBER_KEYS.map((key): [string, string] => [
      key,
      numberValue(key, values[key]) === undefined ? "" : values[key].trim(),
    ]),
  ];
  for (const [key, value] of text) if (value) params.set(key, value);
  if (values.sort !== "created") params.set("sort", values.sort);
  if (values.ascending) params.set("order", "asc");
  if (values.profitable) params.set("profitable", "true");
  return params;
}

/** The `GET /backtests` query for `values` (NOVA-170). */
export function toQuery(values: RunFilterValues): BacktestFilter {
  const query: BacktestFilter = {};
  if (values.q.trim()) query.q = values.q.trim();
  if (values.strategyId) query.strategyId = values.strategyId;
  const status = BacktestRunStatusSchema.safeParse(values.status);
  if (status.success) query.status = status.data;
  const segment = SegmentSchema.safeParse(values.segment);
  if (segment.success) query.segment = segment.data;
  const timeframe = StrategyTimeframeSchema.safeParse(values.timeframe);
  if (timeframe.success) query.timeframe = timeframe.data;
  for (const key of NUMBER_KEYS) {
    const value = numberValue(key, values[key]);
    if (value !== undefined) query[key] = value;
  }
  if (values.profitable) query.profitable = true;
  if (values.sort !== "created") query.sort = values.sort;
  if (values.ascending) query.order = "asc";
  return query;
}

/** True when any filter (not the sort) is set. */
export function hasFilters(values: RunFilterValues): boolean {
  return (
    Boolean(values.q.trim() || values.strategyId || values.status) ||
    hasMoreFilters(values) ||
    values.sort !== "created" ||
    values.ascending
  );
}

/** True when a filter under **More filters** is set (the panel then opens by itself). */
export function hasMoreFilters(values: RunFilterValues): boolean {
  return MORE_KEYS.some((key) =>
    key === "profitable" ? values.profitable : values[key].trim() !== "",
  );
}
