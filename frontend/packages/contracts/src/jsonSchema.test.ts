import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiErrorSchema } from "./error";
import {
  ApprovalRequestSchema,
  AgentAccountSchema,
  AgentAccountCreateSchema,
  AgentPasswordUpdateSchema,
  AgentAccessUpdateSchema,
} from "./approval";
import { LoginRequestSchema } from "./auth";
import { LibraryInstallSchema, StrategyLibrarySchema } from "./library";
import { AuditEntrySchema } from "./audit";
import {
  BacktestDeleteRequestSchema,
  BacktestDeleteResultSchema,
  BacktestResultSchema,
  BacktestRunCreateSchema,
  BacktestRunSchema,
  BacktestVersionCreateSchema,
  BacktestVersionSchema,
} from "./backtest";
import {
  BrokerAccountCreateSchema,
  BrokerAccountSchema,
  BrokerProfileSchema,
  KiteAppSchema,
  KiteAppUpdateSchema,
  KiteKeysUpdateSchema,
  KitePassphraseSchema,
} from "./broker";
import {
  ArchiveJobCreateSchema,
  DataJobCreateSchema,
  DataJobDeleteResultSchema,
  DataJobPlanRequestSchema,
  DataJobPlanSchema,
  DataJobSchema,
  InstrumentSyncResultSchema,
  DownloadSettingsSchema,
} from "./dataJob";
import { CoverageDetailSchema, CoverageListSchema } from "./coverage";
import { UnavailableDaySchema } from "./unavailable";
import { INDICATORS } from "./indicators";
import { CandleSchema, InstrumentSchema, MarketIndexSchema } from "./marketData";
import { RateLimitSchema, RateLimitUpdateSchema } from "./rateLimit";
import { RecorderSettingsSchema, RecorderSettingsUpdateSchema } from "./recorder";
import { StrategySchema } from "./strategy";
import {
  StrategyCreateSchema,
  StrategyUpdateSchema,
  StrategyVersionCreateSchema,
} from "./strategyWrite";
import { StrategyStatsSchema } from "./strategyStats";
import { TradeSchema } from "./trade";
import { UniverseEntrySchema, UniverseEntryWriteSchema, UniverseSectorSchema } from "./universe";
import { UserSchema } from "./user";
import { RealtimeMessageSchema } from "./realtime";
import { pageSchema } from "./common";

// Wire contracts (request/response bodies) exported as JSON Schema for backend parity tests (D34).
// Regenerate with `pnpm --filter @nova/contracts schema:update`. Refinements are not part of JSON Schema.
const contracts: Record<string, z.ZodType> = {
  ApprovalRequest: ApprovalRequestSchema,
  AgentAccount: AgentAccountSchema,
  AgentAccountCreate: AgentAccountCreateSchema,
  AgentPasswordUpdate: AgentPasswordUpdateSchema,
  AgentAccessUpdate: AgentAccessUpdateSchema,
  ApiError: ApiErrorSchema,
  ArchiveJobCreate: ArchiveJobCreateSchema,
  AuditEntry: AuditEntrySchema,
  AuditPage: pageSchema(AuditEntrySchema),
  BacktestResult: BacktestResultSchema,
  BacktestRun: BacktestRunSchema,
  BacktestRunCreate: BacktestRunCreateSchema,
  BrokerAccount: BrokerAccountSchema,
  BrokerAccountCreate: BrokerAccountCreateSchema,
  BrokerProfile: BrokerProfileSchema,
  Candle: CandleSchema,
  CoverageDetail: CoverageDetailSchema,
  CoverageList: CoverageListSchema,
  UnavailableDay: UnavailableDaySchema,
  DataJob: DataJobSchema,
  InstrumentSyncResult: InstrumentSyncResultSchema,
  DataJobCreate: DataJobCreateSchema,
  DataJobDeleteResult: DataJobDeleteResultSchema,
  DataJobPlan: DataJobPlanSchema,
  DataJobPlanRequest: DataJobPlanRequestSchema,
  DownloadSettings: DownloadSettingsSchema,
  Instrument: InstrumentSchema,
  KiteApp: KiteAppSchema,
  KiteAppUpdate: KiteAppUpdateSchema,
  KiteKeysUpdate: KiteKeysUpdateSchema,
  KitePassphrase: KitePassphraseSchema,
  LibraryInstall: LibraryInstallSchema,
  LoginRequest: LoginRequestSchema,
  RateLimit: RateLimitSchema,
  RateLimitUpdate: RateLimitUpdateSchema,
  RecorderSettings: RecorderSettingsSchema,
  RecorderSettingsUpdate: RecorderSettingsUpdateSchema,
  Strategy: StrategySchema,
  StrategyCreate: StrategyCreateSchema,
  StrategyUpdate: StrategyUpdateSchema,
  StrategyVersionCreate: StrategyVersionCreateSchema,
  StrategyStats: StrategyStatsSchema,
  StrategyLibrary: StrategyLibrarySchema,
  BacktestVersion: BacktestVersionSchema,
  BacktestVersionCreate: BacktestVersionCreateSchema,
  BacktestDeleteRequest: BacktestDeleteRequestSchema,
  BacktestDeleteResult: BacktestDeleteResultSchema,
  Trade: TradeSchema,
  UniverseEntry: UniverseEntrySchema,
  MarketIndex: MarketIndexSchema,
  UniverseEntryWrite: UniverseEntryWriteSchema,
  UniverseSector: UniverseSectorSchema,
  User: UserSchema,
  RealtimeMessage: RealtimeMessageSchema,
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
