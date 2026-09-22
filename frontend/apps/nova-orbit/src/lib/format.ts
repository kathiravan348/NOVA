import { formatInTimeZone } from "date-fns-tz";
import type { Segment, StrategyStatus, Timeframe } from "@nova/contracts";

const IST = "Asia/Kolkata";

/** `2026-09-21T06:30:00Z` → `21 Sep 2026` (IST). */
export function formatIstDate(utc: string): string {
  return formatInTimeZone(utc, IST, "d MMM yyyy");
}

/** `2026-09-21T06:30:00Z` → `21 Sep 2026, 12:00 IST`. */
export function formatIstDateTime(utc: string): string {
  return `${formatInTimeZone(utc, IST, "d MMM yyyy, HH:mm")} IST`;
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
