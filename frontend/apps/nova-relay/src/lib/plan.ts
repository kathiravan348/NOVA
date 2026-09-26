import { formatInTimeZone } from "date-fns-tz";
import type { DataJobPlan } from "@nova/contracts";

/** `9_400_000` → `~9.4 MB`; decimal units, like disk sizes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `~${Math.max(1, Math.round(bytes / 1000))} KB`;
  if (bytes < 1_000_000_000) return `~${(bytes / 1_000_000).toFixed(1)} MB`;
  return `~${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

/** `2100` → `about 35 min`; `5400` → `about 1 h 30 min`. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return "less than a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `about ${hours} h ${rest} min` : `about ${hours} h`;
}

/** `Now`, or `After 2 jobs, ~10:40 IST` (the day too when it is not today). */
export function formatStart(plan: DataJobPlan, now: Date = new Date()): string {
  if (plan.jobsAhead === 0) return "Now";
  const sameDay =
    formatInTimeZone(plan.estimatedStartAt, "Asia/Kolkata", "yyyy-MM-dd") ===
    formatInTimeZone(now, "Asia/Kolkata", "yyyy-MM-dd");
  const at = formatInTimeZone(
    plan.estimatedStartAt,
    "Asia/Kolkata",
    sameDay ? "HH:mm" : "d MMM, HH:mm",
  );
  const jobs = plan.jobsAhead === 1 ? "1 job" : `${plan.jobsAhead} jobs`;
  return `After ${jobs}, ~${at} IST`;
}
