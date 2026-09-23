import { brand } from "@nova/brand";
import type { RateLimit, RateLimitEndpoint, RateLimitRule, RateLimitWindow } from "@nova/contracts";

/** Warn when a window passes this share of its own (safety) limit (R3). */
export const WARN_PERCENT = 80;

/** Label for our own safety limit, e.g. "NOVA limit" (brand from config). */
export const OWN_LIMIT_LABEL = `${brand.name} limit`;

export const windowLabel: Record<RateLimitWindow, string> = {
  second: "Per second",
  minute: "Per minute",
  day: "Per day",
};

/** Share of the own limit used, in percent. */
export const usagePercent = (rule: RateLimitRule): number => (rule.used / rule.novaLimit) * 100;

export interface HotWindow {
  accountId: string;
  endpoint: RateLimitEndpoint;
  window: RateLimitWindow;
  percent: number;
}

/** Windows above the warning level, highest first. */
export function hotWindows(limits: RateLimit[]): HotWindow[] {
  return limits
    .flatMap((l) =>
      l.rules.map((r) => ({
        accountId: l.accountId,
        endpoint: l.endpoint,
        window: r.window,
        percent: usagePercent(r),
      })),
    )
    .filter((w) => w.percent > WARN_PERCENT)
    .sort((a, b) => b.percent - a.percent);
}
