export const queryKeys = {
  me: ["me"] as const,
  strategies: {
    all: ["strategies"] as const,
    detail: (id: string) => ["strategies", id] as const,
  },
  backtests: {
    all: ["backtests"] as const,
    detail: (id: string) => ["backtests", id] as const,
    result: (id: string) => ["backtests", id, "result"] as const,
    trades: (id: string) => ["backtests", id, "trades"] as const,
  },
  brokerAccounts: {
    all: ["broker-accounts"] as const,
    detail: (id: string) => ["broker-accounts", id] as const,
  },
  rateLimits: {
    all: ["rate-limits"] as const,
  },
  dataJobs: {
    all: ["data-jobs"] as const,
    detail: (id: string) => ["data-jobs", id] as const,
  },
  auditEntries: {
    all: ["audit-entries"] as const,
  },
};
