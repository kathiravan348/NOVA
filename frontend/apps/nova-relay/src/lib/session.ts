import type { BrokerAccount, BrokerSessionStatus } from "@nova/contracts";

export const sessionLabel: Record<BrokerSessionStatus, string> = {
  active: "Active",
  expired: "Expired",
  not_logged_in: "Not logged in",
};

export const sessionTone: Record<BrokerSessionStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  expired: "warning",
  not_logged_in: "neutral",
};

export const brokerLabel: Record<BrokerAccount["broker"], string> = {
  zerodha: "Zerodha",
};

/** An enabled account whose Kite session is not active needs the daily login. */
export const needsLogin = (account: BrokerAccount) =>
  account.enabled && account.session.status !== "active";

/** Time until a session expires: `18 h 05 m`, `42 m`, or null once it has passed. */
export function timeLeft(expiresAt: string, now: Date): string | null {
  const minutes = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, "0");
  return h > 0 ? `${h} h ${m} m` : `${minutes} m`;
}
