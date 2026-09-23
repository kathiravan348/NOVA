import {
  AuditEntrySchema,
  BacktestResultSchema,
  BacktestRunSchema,
  BrokerAccountSchema,
  CandleSchema,
  DataJobSchema,
  InstrumentSchema,
  RateLimitSchema,
  StrategySchema,
  TradeSchema,
  UserSchema,
  type Candle,
} from "@nova/contracts";
import auditEntriesJson from "../data/auditEntries.json";
import candlesJson from "../data/candles.json";
import instrumentsJson from "../data/instruments.json";
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
export const mockInstruments = InstrumentSchema.array().parse(instrumentsJson);
/** Candles keyed by `<SYMBOL>:<timeframe>`, e.g. `RELIANCE:1d`. */
export const mockCandles: Record<string, Candle[]> = Object.fromEntries(
  Object.entries(candlesJson).map(([key, bars]) => [key, CandleSchema.array().parse(bars)]),
);
