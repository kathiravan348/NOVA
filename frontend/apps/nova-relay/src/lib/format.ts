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
