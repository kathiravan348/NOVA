import type {
  AuditAction,
  DataJobStatus,
  DataJobType,
  RateLimitEndpoint,
  Segment,
} from "@nova/contracts";

export const segmentLabel: Record<Segment, string> = {
  equity_delivery: "Equity delivery",
  equity_intraday: "Equity intraday",
  futures: "Futures",
  options: "Options",
};

export const endpointLabel: Record<RateLimitEndpoint, string> = {
  quote: "Quotes",
  historical: "Historical data",
  orders: "Orders",
  other: "Other",
};

export const jobTypeLabel: Record<DataJobType, string> = {
  historical_download: "Historical download",
  tick_record: "Tick recording",
  archive: "Archive",
};

export const jobStatusLabel: Record<DataJobStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const jobStatusTone: Record<DataJobStatus, "neutral" | "info" | "success" | "danger"> = {
  queued: "neutral",
  running: "info",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
};

export const auditActionLabel: Record<AuditAction, string> = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "broker.login": "Kite login",
  "broker.session_expired": "Kite session expired",
  "broker.rate_limit_update": "Rate limit changed",
  "broker.account_create": "Broker account added",
  "strategy.create": "Strategy created",
  "strategy.update": "Strategy updated",
  "backtest.run": "Backtest run",
  "data_job.create": "Data job created",
  "data_job.cancel": "Data job cancelled",
  "settings.update": "Settings changed",
};

export const AUDIT_GROUPS = [
  "auth",
  "broker",
  "strategy",
  "backtest",
  "data_job",
  "settings",
] as const;
export type AuditGroup = (typeof AUDIT_GROUPS)[number];

export const auditGroupLabel: Record<AuditGroup, string> = {
  auth: "Sign-in",
  broker: "Broker",
  strategy: "Strategies",
  backtest: "Backtests",
  data_job: "Data jobs",
  settings: "Settings",
};

export const auditGroup = (action: AuditAction) => action.split(".")[0] as AuditGroup;
