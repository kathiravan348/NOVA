import { formatInTimeZone } from "date-fns-tz";
import type { BacktestRunStatus, Segment, StrategyStatus, Timeframe } from "@nova/contracts";

const IST = "Asia/Kolkata";

export const runStatusLabel: Record<BacktestRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

export const runStatusTone: Record<BacktestRunStatus, "neutral" | "info" | "success" | "danger"> = {
  queued: "neutral",
  running: "info",
  completed: "success",
  failed: "danger",
};

/** `2026-06-01`, `2026-06-15` → `1 Jun – 15 Jun 2026` (years shown on both sides when they differ). */
export function formatPeriod(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const start = formatInTimeZone(`${from}T00:00:00Z`, "UTC", sameYear ? "d MMM" : "d MMM yyyy");
  return `${start} – ${formatCalendarDate(to)}`;
}

/** `2026-09-21T06:30:00Z` → `21 Sep 2026` (IST). */
export function formatIstDate(utc: string): string {
  return formatInTimeZone(utc, IST, "d MMM yyyy");
}

/** `2026-09-21T06:30:00Z` → `21 Sep 2026, 12:00 IST`. */
export function formatIstDateTime(utc: string): string {
  return `${formatInTimeZone(utc, IST, "d MMM yyyy, HH:mm")} IST`;
}

/** `2026-06-02T04:00:00Z` → `2 Jun, 09:30` (IST, for dense tables). */
export function formatIstShort(utc: string): string {
  return formatInTimeZone(utc, IST, "d MMM, HH:mm");
}

/** Calendar date `2026-09-21` → `21 Sep 2026` (no time zone shift). */
export function formatCalendarDate(isoDate: string): string {
  return formatInTimeZone(`${isoDate}T00:00:00Z`, "UTC", "d MMM yyyy");
}

export const segmentLabel: Record<Segment, string> = {
  equity_delivery: "Equity delivery",
  equity_intraday: "Equity intraday",
  futures: "Futures",
  options: "Options",
};

export const timeframeLabel: Record<Timeframe, string> = {
  "1m": "1 minute",
  "3m": "3 minutes",
  "5m": "5 minutes",
  "15m": "15 minutes",
  "30m": "30 minutes",
  "1h": "1 hour",
  "1d": "1 day",
};

export const strategyStatusLabel: Record<StrategyStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export const strategyStatusTone: Record<StrategyStatus, "success" | "info" | "neutral"> = {
  active: "success",
  draft: "info",
  archived: "neutral",
};
