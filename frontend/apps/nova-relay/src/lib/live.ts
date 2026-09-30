import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
/** A card turns amber when the last tick is older than this in market hours (D74). */
export const STALE_SECONDS = 10;

/** Weekday 09:15–15:30 IST. */
export function isMarketOpen(now: Date): boolean {
  const day = Number(formatInTimeZone(now, IST, "i")); // 1 = Monday … 7 = Sunday
  const minutes =
    Number(formatInTimeZone(now, IST, "H")) * 60 + Number(formatInTimeZone(now, IST, "m"));
  return day <= 5 && minutes >= 9 * 60 + 15 && minutes < 15 * 60 + 30;
}

/** No tick yet, or the last one is older than `STALE_SECONDS`, while the market is open. */
export function isStale(lastTickAt: string | null, now: Date): boolean {
  if (!isMarketOpen(now)) return false;
  if (lastTickAt === null) return true;
  return (now.getTime() - Date.parse(lastTickAt)) / 1000 > STALE_SECONDS;
}

export function formatClock(utc: string): string {
  return formatInTimeZone(new Date(utc), IST, "HH:mm:ss");
}
