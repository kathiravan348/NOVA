import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function toZonedInputValue(utcIso: string, timeZone = "Asia/Kolkata"): string {
  if (!utcIso) return "";
  const date = new Date(utcIso);
  if (isNaN(date.getTime())) return "";
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd'T'HH:mm");
}

export function fromZonedInputValue(local: string, timeZone = "Asia/Kolkata"): string {
  if (!local) return "";
  const date = fromZonedTime(local, timeZone);
  if (isNaN(date.getTime())) return "";
  return formatInTimeZone(date, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
}
