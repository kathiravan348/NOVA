import type {
  AuditAction,
  DataJobStatus,
  DataJobType,
  RateLimitEndpoint,
  RecorderState,
  Segment,
  Timeframe,
} from "@nova/contracts";

export const segmentLabel: Record<Segment, string> = {
  equity_delivery: "Equity delivery",
  equity_intraday: "Equity intraday",
  futures: "Futures",
  options: "Options",
};

export const timeframeLabel: Record<Timeframe, string> = {
  "1m": "1 minute",
  "3m": "3 minutes",
  "5m": "5 minutes",
  "15m": "15 minutes",
  "30m": "30 minutes",
  "1h": "1 hour",
  "1d": "1 day",
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
  "instrument.add": "Stock added",
  "instrument.update": "Stock updated",
  "instrument.remove": "Stock removed",
  "instrument.sync": "Stocks synced with Kite",
  "settings.update": "Settings changed",
};

export const AUDIT_GROUPS = [
  "auth",
  "broker",
  "strategy",
  "backtest",
  "data_job",
  "instrument",
  "settings",
] as const;
export type AuditGroup = (typeof AUDIT_GROUPS)[number];

export const auditGroupLabel: Record<AuditGroup, string> = {
  auth: "Sign-in",
  broker: "Broker",
  strategy: "Strategies",
  backtest: "Backtests",
  data_job: "Data jobs",
  instrument: "Instruments",
  settings: "Settings",
};

export const auditGroup = (action: AuditAction) => action.split(".")[0] as AuditGroup;

export const recorderStateLabel: Record<RecorderState, string> = {
  off: "Off",
  waiting: "Waiting for market hours",
  recording: "Recording",
  no_login: "Log in to Kite first",
};

export const recorderStateTone: Record<RecorderState, "neutral" | "info" | "success" | "warning"> =
  {
    off: "neutral",
    waiting: "info",
    recording: "success",
    no_login: "warning",
  };
