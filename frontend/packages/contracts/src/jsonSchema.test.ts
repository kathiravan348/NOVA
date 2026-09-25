import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiErrorSchema } from "./error";
import { LoginRequestSchema } from "./auth";
import { AuditEntrySchema } from "./audit";
import { BacktestResultSchema, BacktestRunCreateSchema, BacktestRunSchema } from "./backtest";
import { BrokerAccountCreateSchema, BrokerAccountSchema, BrokerProfileSchema } from "./broker";
import { DataJobSchema } from "./dataJob";
import { INDICATORS } from "./indicators";
import { CandleSchema, InstrumentSchema } from "./marketData";
import { RateLimitSchema, RateLimitUpdateSchema } from "./rateLimit";
import {
  StrategyCreateSchema,
  StrategySchema,
  StrategyUpdateSchema,
  StrategyVersionCreateSchema,
} from "./strategy";
import { StrategyStatsSchema } from "./strategyStats";
import { TradeSchema } from "./trade";
import { UserSchema } from "./user";

// Wire contracts (request/response bodies) exported as JSON Schema for backend parity tests (D34).
// Regenerate with `pnpm --filter @nova/contracts schema:update`. Refinements are not part of JSON Schema.
const contracts: Record<string, z.ZodType> = {
  ApiError: ApiErrorSchema,
  AuditEntry: AuditEntrySchema,
  BacktestResult: BacktestResultSchema,
  BacktestRun: BacktestRunSchema,
  BacktestRunCreate: BacktestRunCreateSchema,
  BrokerAccount: BrokerAccountSchema,
  BrokerAccountCreate: BrokerAccountCreateSchema,
  BrokerProfile: BrokerProfileSchema,
  Candle: CandleSchema,
  DataJob: DataJobSchema,
  Instrument: InstrumentSchema,
  LoginRequest: LoginRequestSchema,
  RateLimit: RateLimitSchema,
  RateLimitUpdate: RateLimitUpdateSchema,
  Strategy: StrategySchema,
  StrategyCreate: StrategyCreateSchema,
  StrategyUpdate: StrategyUpdateSchema,
  StrategyVersionCreate: StrategyVersionCreateSchema,
  StrategyStats: StrategyStatsSchema,
  Trade: TradeSchema,
  User: UserSchema,
};

describe("JSON Schema export", () => {
  // Iterate names only: printing a Zod schema into a test title runs out of memory.
  it.each(Object.keys(contracts))("%s matches its schema file", async (name) => {
    const json = z.toJSONSchema(contracts[name]!, { io: "input" });
    await expect(JSON.stringify(json, null, 2) + "\n").toMatchFileSnapshot(
      `../schema/${name}.json`,
    );
  });
});

describe("indicator catalog export (D51)", () => {
  it("matches schema/indicators.json", async () => {
    const json = JSON.stringify(INDICATORS, null, 2) + "\n";
    await expect(json).toMatchFileSnapshot("../schema/indicators.json");
  });
});
