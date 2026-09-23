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
import { describe, expect, it } from "vitest";
import {
  MOCK_NOW,
  mockAuditEntries,
  mockBacktestResults,
  mockBacktestRuns,
  mockBrokerAccounts,
  mockDataJobs,
  mockRateLimits,
  mockBrokerProfiles,
  mockStrategies,
  mockTrades,
  mockUser,
} from "./data";

describe("Mock data schemas and general conventions", () => {
  it("validates mockUser against UserSchema", () => {
    expect(UserSchema.safeParse(mockUser).success).toBe(true);
  });

  it("validates mockStrategies against StrategySchema array", () => {
    expect(StrategySchema.array().safeParse(mockStrategies).success).toBe(true);
  });

  it("validates mockBacktestRuns against BacktestRunSchema array", () => {
    expect(BacktestRunSchema.array().safeParse(mockBacktestRuns).success).toBe(true);
  });

  it("validates mockBacktestResults against BacktestResultSchema array", () => {
    expect(BacktestResultSchema.array().safeParse(mockBacktestResults).success).toBe(true);
  });

  it("validates mockTrades against TradeSchema array", () => {
    expect(TradeSchema.array().safeParse(mockTrades).success).toBe(true);
  });

  it("validates mockBrokerAccounts against BrokerAccountSchema array", () => {
    expect(BrokerAccountSchema.array().safeParse(mockBrokerAccounts).success).toBe(true);
  });

  it("validates mockRateLimits against RateLimitSchema array", () => {
    expect(RateLimitSchema.array().safeParse(mockRateLimits).success).toBe(true);
  });

  it("validates mockDataJobs against DataJobSchema array", () => {
    expect(DataJobSchema.array().safeParse(mockDataJobs).success).toBe(true);
  });

  it("validates mockAuditEntries against AuditEntrySchema array", () => {
    expect(AuditEntrySchema.array().safeParse(mockAuditEntries).success).toBe(true);
  });

  it("ensures ids are unique per collection", () => {
    const checkUnique = (ids: string[]) => {
      expect(new Set(ids).size).toBe(ids.length);
    };

    checkUnique(mockStrategies.map((s) => s.id));
    checkUnique(mockBacktestRuns.map((r) => r.id));
    checkUnique(mockBacktestResults.map((r) => r.runId));
    checkUnique(mockTrades.map((t) => t.id));
    checkUnique(mockBrokerAccounts.map((b) => b.id));
    checkUnique(mockDataJobs.map((j) => j.id));
    checkUnique(mockAuditEntries.map((a) => a.id));
  });

  it("ensures all strategy enums from step 4 appear at least once", () => {
    const statuses = new Set(mockStrategies.map((s) => s.status));
    expect(statuses.has("active")).toBe(true);
    expect(statuses.has("draft")).toBe(true);
    expect(statuses.has("archived")).toBe(true);

    const modes = new Set(mockStrategies.flatMap((s) => s.versions.map((v) => v.spec.mode)));
    expect(modes.has("visual")).toBe(true);
    expect(modes.has("python")).toBe(true);

    const segments = new Set(mockStrategies.flatMap((s) => s.versions.map((v) => v.spec.segment)));
    expect(segments.has("equity_intraday")).toBe(true);
    expect(segments.has("equity_delivery")).toBe(true);

    const timeframes = new Set(
      mockStrategies.flatMap((s) => s.versions.map((v) => v.spec.timeframe)),
    );
    expect(timeframes.has("5m")).toBe(true);
    expect(timeframes.has("1d")).toBe(true);
  });

  it("ensures all backtest run statuses from step 4 appear at least once", () => {
    const statuses = new Set(mockBacktestRuns.map((r) => r.status));
    expect(statuses.has("completed")).toBe(true);
    expect(statuses.has("running")).toBe(true);
    expect(statuses.has("queued")).toBe(true);
    expect(statuses.has("failed")).toBe(true);
  });

  it("ensures all trade sides appear at least once", () => {
    const sides = new Set(mockTrades.map((t) => t.side));
    expect(sides.has("buy")).toBe(true);
    expect(sides.has("sell")).toBe(true);
  });

  it("ensures all broker session statuses appear at least once", () => {
    const statuses = new Set(mockBrokerAccounts.map((b) => b.session.status));
    expect(statuses.has("active")).toBe(true);
    expect(statuses.has("expired")).toBe(true);
    expect(statuses.has("not_logged_in")).toBe(true);
  });

  it("ensures all rate limit endpoints appear at least once", () => {
    const endpoints = new Set(mockRateLimits.map((r) => r.endpoint));
    expect(endpoints.has("quote")).toBe(true);
    expect(endpoints.has("historical")).toBe(true);
    expect(endpoints.has("orders")).toBe(true);
    expect(endpoints.has("other")).toBe(true);
  });

  it("ensures all data job statuses and types appear at least once", () => {
    const statuses = new Set(mockDataJobs.map((j) => j.status));
    expect(statuses.has("queued")).toBe(true);
    expect(statuses.has("running")).toBe(true);
    expect(statuses.has("completed")).toBe(true);
    expect(statuses.has("failed")).toBe(true);
    expect(statuses.has("cancelled")).toBe(true);

    const types = new Set(mockDataJobs.map((j) => j.type));
    expect(types.has("historical_download")).toBe(true);
    expect(types.has("tick_record")).toBe(true);
    expect(types.has("archive")).toBe(true);
  });

  it("ensures audit entries contain both system and user actors", () => {
    expect(mockAuditEntries.some((a) => a.actorId === null && a.actorName === "System")).toBe(true);
    expect(mockAuditEntries.some((a) => a.actorId === mockUser.id)).toBe(true);
  });

  it("ensures all timestamps are <= MOCK_NOW except active broker session expiresAt", () => {
    const mockNowTs = new Date(MOCK_NOW).getTime();

    expect(new Date(mockUser.createdAt).getTime()).toBeLessThanOrEqual(mockNowTs);
    if (mockUser.lastLoginAt) {
      expect(new Date(mockUser.lastLoginAt).getTime()).toBeLessThanOrEqual(mockNowTs);
    }

    for (const s of mockStrategies) {
      expect(new Date(s.createdAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      expect(new Date(s.updatedAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      for (const v of s.versions) {
        expect(new Date(v.createdAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      }
    }

    for (const r of mockBacktestRuns) {
      expect(new Date(r.createdAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      if (r.startedAt) expect(new Date(r.startedAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      if (r.finishedAt) expect(new Date(r.finishedAt).getTime()).toBeLessThanOrEqual(mockNowTs);
    }

    for (const t of mockTrades) {
      expect(new Date(t.entryAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      if (t.exitAt) expect(new Date(t.exitAt).getTime()).toBeLessThanOrEqual(mockNowTs);
    }

    for (const b of mockBrokerAccounts) {
      expect(new Date(b.createdAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      if (b.session.loggedInAt) {
        expect(new Date(b.session.loggedInAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      }
      if (b.session.status !== "active" && b.session.expiresAt) {
        expect(new Date(b.session.expiresAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      }
    }

    for (const r of mockRateLimits) {
      expect(new Date(r.updatedAt).getTime()).toBeLessThanOrEqual(mockNowTs);
    }

    for (const j of mockDataJobs) {
      expect(new Date(j.createdAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      if (j.startedAt) expect(new Date(j.startedAt).getTime()).toBeLessThanOrEqual(mockNowTs);
      if (j.finishedAt) expect(new Date(j.finishedAt).getTime()).toBeLessThanOrEqual(mockNowTs);
    }

    for (const a of mockAuditEntries) {
      expect(new Date(a.at).getTime()).toBeLessThanOrEqual(mockNowTs);
    }
  });

  it("ensures no brand text NOVA exists in textual fields", () => {
    const allJsonString = JSON.stringify({
      mockUser,
      mockStrategies,
      mockBacktestRuns,
      mockBacktestResults,
      mockTrades,
      mockBrokerAccounts,
      mockRateLimits,
      mockBrokerProfiles,
      mockDataJobs,
      mockAuditEntries,
    });
    expect(allJsonString).not.toMatch(/\bNOVA\b/);
  });

  it("ensures email uses example.com", () => {
    expect(mockUser.email.endsWith("@example.com")).toBe(true);
  });

  it("ensures ip addresses use 203.0.113.x subnet", () => {
    for (const a of mockAuditEntries) {
      if (a.ip !== null) {
        expect(a.ip).toMatch(/^203\.0\.113\.\d+$/);
      }
    }
  });

  it("ensures broker client IDs match fake format", () => {
    for (const b of mockBrokerAccounts) {
      expect(b.clientId).toMatch(/^[A-Z]{2}\d{4}$/);
    }
  });
});
