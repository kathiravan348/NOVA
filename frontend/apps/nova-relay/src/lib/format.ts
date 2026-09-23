import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

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

/** `2026-06-01`, `2026-06-15` → `1 Jun – 15 Jun 2026` (years shown on both sides when they differ). */
export function formatPeriod(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const start = formatInTimeZone(`${from}T00:00:00Z`, "UTC", sameYear ? "d MMM" : "d MMM yyyy");
  return `${start} – ${formatCalendarDate(to)}`;
}
