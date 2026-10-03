export const queryKeys = {
  research: {
    all: ["research"] as const,
    list: ["research", "list"] as const,
    detail: (id: string) => ["research", "detail", id] as const,
  },
  live: {
    all: ["live"] as const,
    snapshot: (symbols: string[]) => ["live", "snapshot", symbols] as const,
    days: (symbol: string) => ["live", "days", symbol] as const,
    stocks: (symbols: string[]) => ["live", "stocks", symbols] as const,
    checks: (limit: number) => ["live", "checks", limit] as const,
  },
  approvals: {
    all: ["approvals"] as const,
    list: (status?: string) => ["approvals", "list", status] as const,
  },
  agent: ["agent"] as const,
  me: ["me"] as const,
  strategies: {
    all: ["strategies"] as const,
    stats: ["strategies", "stats"] as const,
    detail: (id: string) => ["strategies", id] as const,
  },
  /** Fixed data (D62 (7)); not under "strategies", so saving a strategy does not refetch it. */
  strategyLibrary: ["strategy-library"] as const,
  backtests: {
    all: ["backtests"] as const,
    lists: ["backtests", "list"] as const,
    list: (filter: object) => ["backtests", "list", filter] as const,
    detail: (id: string) => ["backtests", id] as const,
    result: (id: string) => ["backtests", id, "result"] as const,
    trades: (id: string) => ["backtests", id, "trades"] as const,
    versions: (id: string) => ["backtests", id, "versions"] as const,
  },
  brokerAccounts: {
    all: ["broker-accounts"] as const,
    detail: (id: string) => ["broker-accounts", id] as const,
  },
  recorder: ["recorder"] as const,
  downloadSettings: ["download-settings"] as const,
  kiteApp: (accountId: string) => ["kite-app", accountId] as const,
  rateLimits: {
    all: ["rate-limits"] as const,
  },
  brokerProfiles: {
    all: ["broker-profiles"] as const,
    detail: (broker: string) => ["broker-profiles", broker] as const,
  },
  dataJobs: {
    all: ["data-jobs"] as const,
    list: ["data-jobs", "list"] as const,
    latestSync: ["data-jobs", "latest-sync"] as const,
    detail: (id: string) => ["data-jobs", id] as const,
  },
  auditEntries: {
    all: ["audit-entries"] as const,
    list: ["audit-entries", "list"] as const,
  },
  marketData: {
    instruments: ["market-data", "instruments"] as const,
    universe: ["market-data", "universe"] as const,
    indices: ["market-data", "indices"] as const,
    candles: (symbol: string, timeframe: string) =>
      ["market-data", "candles", symbol, timeframe] as const,
    coverageAll: ["market-data", "coverage"] as const,
    coverage: (query: object) => ["market-data", "coverage", "list", query] as const,
    coverageDetail: (symbol: string, query: object) =>
      ["market-data", "coverage", "detail", symbol, query] as const,
  },
};
