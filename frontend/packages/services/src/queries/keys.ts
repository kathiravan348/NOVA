export const queryKeys = {
  me: ["me"] as const,
  strategies: {
    all: ["strategies"] as const,
    stats: ["strategies", "stats"] as const,
    detail: (id: string) => ["strategies", id] as const,
  },
  backtests: {
    all: ["backtests"] as const,
    list: (filter: { strategyId?: string }) => ["backtests", "list", filter] as const,
    detail: (id: string) => ["backtests", id] as const,
    result: (id: string) => ["backtests", id, "result"] as const,
    trades: (id: string) => ["backtests", id, "trades"] as const,
  },
  brokerAccounts: {
    all: ["broker-accounts"] as const,
    detail: (id: string) => ["broker-accounts", id] as const,
  },
  recorder: ["recorder"] as const,
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
  },
};
