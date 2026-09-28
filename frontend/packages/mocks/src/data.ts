import {
  ApprovalRequestSchema,
  AgentAccountSchema,
  AuditEntrySchema,
  BacktestResultSchema,
  BacktestRunSchema,
  BrokerAccountSchema,
  CandleSchema,
  CoverageDetailSchema,
  CoverageListSchema,
  DataJobSchema,
  InstrumentSchema,
  RateLimitSchema,
  BrokerProfileSchema,
  KiteAppSchema,
  StrategyLibrarySchema,
  StrategySchema,
  StrategyStatsSchema,
  TradeSchema,
  UserSchema,
  type Candle,
} from "@nova/contracts";
import auditEntriesJson from "../data/auditEntries.json";
import candlesJson from "../data/candles.json";
import coverageJson from "../data/coverage.json";
import instrumentsJson from "../data/instruments.json";
import backtestResultsJson from "../data/backtestResults.json";
import backtestRunsJson from "../data/backtestRuns.json";
import brokerAccountsJson from "../data/brokerAccounts.json";
import dataJobsJson from "../data/dataJobs.json";
import rateLimitsJson from "../data/rateLimits.json";
import brokerProfilesJson from "../data/brokerProfiles.json";
import kiteAppsJson from "../data/kiteApps.json";
import strategiesJson from "../data/strategies.json";
import strategyLibraryJson from "../data/strategyLibrary.json";
import strategyStatsJson from "../data/strategyStats.json";
import tradesJson from "../data/trades.json";
import userJson from "../data/user.json";

export const MOCK_NOW = "2026-09-21T06:30:00Z";

export const mockUser = UserSchema.parse(userJson);
export const mockAgentAccount = AgentAccountSchema.parse({
  id: "usr_agent",
  name: "Debug Agent",
  email: "agent@example.com",
  enabled: true,
  createdAt: "2026-09-21T06:30:00Z",
  lastLoginAt: null,
});
/** What mock sign-in answers for an `agent@…` email (D67). */
export const mockAgentUser = UserSchema.parse({
  ...mockUser,
  id: mockAgentAccount.id,
  name: mockAgentAccount.name,
  email: mockAgentAccount.email,
  role: "agent",
});
export const mockApprovals = ApprovalRequestSchema.array().parse([
  {
    id: "approval_pending",
    method: "POST",
    path: "/backtests",
    query: "",
    body: { name: "Agent backtest" },
    status: "pending",
    agentName: "Debug Agent",
    createdAt: "2026-09-21T06:30:00Z",
    decidedAt: null,
    decidedBy: null,
    resultStatus: null,
    resultBody: null,
  },
  {
    id: "approval_done",
    method: "PATCH",
    path: "/strategies/stg_001",
    query: "",
    body: { name: "Updated strategy" },
    status: "done",
    agentName: "Debug Agent",
    createdAt: "2026-09-21T06:20:00Z",
    decidedAt: "2026-09-21T06:25:00Z",
    decidedBy: "Admin",
    resultStatus: 200,
    resultBody: "{}",
  },
  {
    id: "approval_rejected",
    method: "DELETE",
    path: "/backtests/run_001",
    query: "scope=all",
    body: null,
    status: "rejected",
    agentName: "Debug Agent",
    createdAt: "2026-09-21T06:10:00Z",
    decidedAt: "2026-09-21T06:15:00Z",
    decidedBy: "Admin",
    resultStatus: null,
    resultBody: null,
  },
]);
export const mockStrategies = StrategySchema.array().parse(strategiesJson);
export const mockStrategyStats = StrategyStatsSchema.array().parse(strategyStatsJson);
/** 7 of the 60 library strategies, one per family (D62 (7)); the real list is served by the backend. */
export const mockStrategyLibrary = StrategyLibrarySchema.parse(strategyLibraryJson);
export const mockBacktestRuns = BacktestRunSchema.array().parse(backtestRunsJson);
export const mockBacktestResults = BacktestResultSchema.array().parse(backtestResultsJson);
export const mockTrades = TradeSchema.array().parse(tradesJson);
export const mockBrokerAccounts = BrokerAccountSchema.array().parse(brokerAccountsJson);
export const mockRateLimits = RateLimitSchema.array().parse(rateLimitsJson);
export const mockBrokerProfiles = BrokerProfileSchema.array().parse(brokerProfilesJson);
export const mockKiteApps = KiteAppSchema.array().parse(kiteAppsJson);
export const mockDataJobs = DataJobSchema.array().parse(dataJobsJson);
export const mockAuditEntries = AuditEntrySchema.array().parse(auditEntriesJson);
export const mockInstruments = InstrumentSchema.array().parse(instrumentsJson);
/** Candles keyed by `<SYMBOL>:<timeframe>`, e.g. `RELIANCE:1d`. */
export const mockCandles: Record<string, Candle[]> = Object.fromEntries(
  Object.entries(candlesJson).map(([key, bars]) => [key, CandleSchema.array().parse(bars)]),
);
/** Stored-data lists for `1d` and `1m`, and missing ranges of a few stocks (D63). */
export const mockCoverageLists = CoverageListSchema.array().parse(coverageJson.lists);
export const mockCoverageDetails = CoverageDetailSchema.array().parse(coverageJson.details);
