import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

/**
 * How long a position was held (D83). Same IST day: the two largest of h / min / s, zero parts dropped
 * (`42 s`, `12 min`, `2 h 5 min`). Different IST days: calendar days (`1 day`, `3 days`).
 */
export function heldTime(entryAt: string, at: string): string {
  const days = differenceInCalendarDays(
    parseISO(formatInTimeZone(at, IST, "yyyy-MM-dd")),
    parseISO(formatInTimeZone(entryAt, IST, "yyyy-MM-dd")),
  );
  if (days > 0) return days === 1 ? "1 day" : `${days} days`;
  const total = Math.max(0, Math.round((Date.parse(at) - Date.parse(entryAt)) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: [number, string][] = hours
    ? [
        [hours, "h"],
        [minutes, "min"],
      ]
    : minutes
      ? [
          [minutes, "min"],
          [seconds, "s"],
        ]
      : [[seconds, "s"]];
  const shown = parts.filter(([value], index) => index === 0 || value > 0);
  return shown.map(([value, unit]) => `${value} ${unit}`).join(" ");
}
