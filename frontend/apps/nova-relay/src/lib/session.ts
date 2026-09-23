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
