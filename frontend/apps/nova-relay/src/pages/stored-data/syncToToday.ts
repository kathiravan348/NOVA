import {
  DataJobPlanRequestSchema,
  type CoverageRow,
  type CoverageTimeframe,
  type DataJobPlanRequest,
} from "@nova/contracts";
import { getCoverageDetail, getUnavailableDays } from "@nova/services";
import { DATA_START_DAY } from "../../lib/format";

export interface SyncBatchState {
  syncPlans: DataJobPlanRequest[];
}

/** Validate router state before it can create drafts. */
export function downloadPrefill(state: unknown) {
  const parsed = DataJobPlanRequestSchema.safeParse(state);
  if (!parsed.success || !["1m", "1d"].includes(parsed.data.timeframe)) return null;
  const { symbols, timeframe, from, to, mode } = parsed.data;
  return {
    stocks: symbols.filter((s) => !s.includes(" ")),
    indices: symbols.filter((s) => s.includes(" ")),
    timeframe,
    from,
    to,
    mode,
  };
}

export function syncBatch(state: unknown): DataJobPlanRequest[] {
  if (!state || typeof state !== "object" || !("syncPlans" in state)) return [];
  if (!Array.isArray(state.syncPlans) || state.syncPlans.length === 0) return [];
  const plans: DataJobPlanRequest[] = [];
  for (const entry of state.syncPlans) {
    const parsed = DataJobPlanRequestSchema.safeParse(entry);
    if (!parsed.success || !["1m", "1d"].includes(parsed.data.timeframe)) return [];
    plans.push(parsed.data);
  }
  return plans;
}

export function needsSync(row: CoverageRow, today: string): boolean {
  return (
    row.lastDay === null || row.lastDay < today || row.missingDays > (row.unavailableDays ?? 0)
  );
}

const shiftDay = (day: string, shift: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + shift * 86_400_000).toISOString().slice(0, 10);

/** Split date windows so a routine request never includes an explained unavailable date. */
export function excludeDays(from: string, to: string, unavailable: string[]) {
  const ranges: { from: string; to: string }[] = [];
  let start = from;
  for (const day of [...new Set(unavailable)].filter((d) => d >= from && d <= to).sort()) {
    if (start < day) ranges.push({ from: start, to: shiftDay(day, -1) });
    start = shiftDay(day, 1);
  }
  if (start <= to) ranges.push({ from: start, to });
  return ranges;
}

/** Read-only preparation. Drafts and starts are created only on the download page. */
export async function prepareSync(
  series: { timeframe: CoverageTimeframe; rows: CoverageRow[] }[],
  today: string,
): Promise<DataJobPlanRequest[]> {
  const plans: DataJobPlanRequest[] = [];
  for (const { timeframe, rows } of series) {
    const query = { timeframe, from: DATA_START_DAY, to: today };
    const unavailable: { symbol: string; day: string }[] = [];
    let cursor: string | undefined;
    do {
      const page = await getUnavailableDays(
        { ...query, status: "unavailable", limit: 200 },
        cursor,
      );
      unavailable.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    // Bound concurrent reads even when All stocks contains thousands of instruments.
    const candidates = [
      ...new Map(rows.filter((r) => needsSync(r, today)).map((r) => [r.symbol, r])).values(),
    ];
    for (let offset = 0; offset < candidates.length; offset += 4) {
      const batches = await Promise.all(
        candidates.slice(offset, offset + 4).map(async (row) => {
          const missing =
            row.missingDays > (row.unavailableDays ?? 0)
              ? (await getCoverageDetail(row.symbol, query)).missing
              : [];
          const windows = [...missing];
          if (row.lastDay === null || row.lastDay < today)
            windows.push({ from: row.lastDay ?? DATA_START_DAY, to: today, days: 0 });
          const excluded = unavailable.filter((d) => d.symbol === row.symbol).map((d) => d.day);
          return windows.flatMap((range) =>
            excludeDays(range.from, range.to, excluded).map((dates) => ({
              symbols: [row.symbol],
              timeframe,
              ...dates,
              segment: "equity_delivery" as const,
              mode: "skip_existing" as const,
            })),
          );
        }),
      );
      plans.push(...batches.flat());
    }
  }
  return mergeSameWindow(plans);
}

/** One plan per timeframe and date window: stocks that need the same days are reviewed together. */
function mergeSameWindow(plans: DataJobPlanRequest[]): DataJobPlanRequest[] {
  const merged = new Map<string, DataJobPlanRequest>();
  for (const plan of plans) {
    const key = `${plan.timeframe}|${plan.from}|${plan.to}`;
    const found = merged.get(key);
    if (found) found.symbols = [...new Set([...found.symbols, ...plan.symbols])];
    else merged.set(key, { ...plan, symbols: [...plan.symbols] });
  }
  return [...merged.values()];
}

/** Calendar date windows, not an estimate of trading sessions or broker requests. */
export function syncDateDays(plans: DataJobPlanRequest[]) {
  return plans.reduce(
    (sum, p) => sum + (Date.parse(p.to) - Date.parse(p.from)) / 86_400_000 + 1,
    0,
  );
}
