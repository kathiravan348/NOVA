import {
  AuditEntrySchema,
  BacktestResultSchema,
  BacktestRunSchema,
  BrokerAccountSchema,
  DataJobSchema,
  RateLimitSchema,
  StrategySchema,
  TradeSchema,
  UserSchema,
} from "@nova/contracts";
import auditEntriesJson from "../data/auditEntries.json";
import backtestResultsJson from "../data/backtestResults.json";
import backtestRunsJson from "../data/backtestRuns.json";
import brokerAccountsJson from "../data/brokerAccounts.json";
import dataJobsJson from "../data/dataJobs.json";
import rateLimitsJson from "../data/rateLimits.json";
import strategiesJson from "../data/strategies.json";
import tradesJson from "../data/trades.json";
import userJson from "../data/user.json";

export const MOCK_NOW = "2026-09-21T06:30:00Z";

export const mockUser = UserSchema.parse(userJson);
export const mockStrategies = StrategySchema.array().parse(strategiesJson);
export const mockBacktestRuns = BacktestRunSchema.array().parse(backtestRunsJson);
export const mockBacktestResults = BacktestResultSchema.array().parse(backtestResultsJson);
export const mockTrades = TradeSchema.array().parse(tradesJson);
export const mockBrokerAccounts = BrokerAccountSchema.array().parse(brokerAccountsJson);
export const mockRateLimits = RateLimitSchema.array().parse(rateLimitsJson);
export const mockDataJobs = DataJobSchema.array().parse(dataJobsJson);
export const mockAuditEntries = AuditEntrySchema.array().parse(auditEntriesJson);
