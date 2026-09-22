import { describe, expect, it } from "vitest";
import {
  MOCK_NOW,
  mockAuditEntries,
  mockBacktestRuns,
  mockBrokerAccounts,
  mockDataJobs,
  mockRateLimits,
  mockStrategies,
  mockUser,
} from "./data";

describe("Relay consistency rules", () => {
  it("ensures active sessions have expiresAt > MOCK_NOW", () => {
    const activeAccounts = mockBrokerAccounts.filter((b) => b.session.status === "active");
    expect(activeAccounts.length).toBeGreaterThan(0);
    const mockNowTs = new Date(MOCK_NOW).getTime();
    for (const b of activeAccounts) {
      expect(new Date(b.session.expiresAt as string).getTime()).toBeGreaterThan(mockNowTs);
    }
  });

  it("ensures expired sessions have expiresAt <= MOCK_NOW", () => {
    const expiredAccounts = mockBrokerAccounts.filter((b) => b.session.status === "expired");
    expect(expiredAccounts.length).toBeGreaterThan(0);
    const mockNowTs = new Date(MOCK_NOW).getTime();
    for (const b of expiredAccounts) {
      expect(new Date(b.session.expiresAt as string).getTime()).toBeLessThanOrEqual(mockNowTs);
    }
  });

  it("ensures not_logged_in accounts have enabled false and null timestamps", () => {
    const notLoggedIn = mockBrokerAccounts.filter((b) => b.session.status === "not_logged_in");
    expect(notLoggedIn.length).toBeGreaterThan(0);
    for (const b of notLoggedIn) {
      expect(b.enabled).toBe(false);
      expect(b.session.loggedInAt).toBeNull();
      expect(b.session.expiresAt).toBeNull();
    }
  });

  it("ensures each rate limit's accountId is an enabled account", () => {
    const enabledAccountIds = new Set(mockBrokerAccounts.filter((b) => b.enabled).map((b) => b.id));
    for (const rateLimit of mockRateLimits) {
      expect(enabledAccountIds.has(rateLimit.accountId)).toBe(true);
    }
  });

  it("ensures (accountId, endpoint) pairs are unique across rate limits", () => {
    const pairs = mockRateLimits.map((r) => `${r.accountId}:${r.endpoint}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("ensures enabled accounts cover all 4 endpoints in rate limits", () => {
    const enabledAccounts = mockBrokerAccounts.filter((b) => b.enabled);
    const expectedEndpoints = ["quote", "historical", "orders", "other"];

    for (const account of enabledAccounts) {
      const endpointsForAccount = mockRateLimits
        .filter((r) => r.accountId === account.id)
        .map((r) => r.endpoint);
      for (const endpoint of expectedEndpoints) {
        expect(endpointsForAccount).toContain(endpoint);
      }
    }
  });

  it("ensures data jobs have createdAt <= startedAt <= finishedAt when set", () => {
    for (const job of mockDataJobs) {
      const createdTs = new Date(job.createdAt).getTime();
      if (job.startedAt) {
        const startedTs = new Date(job.startedAt).getTime();
        expect(createdTs).toBeLessThanOrEqual(startedTs);
        if (job.finishedAt) {
          const finishedTs = new Date(job.finishedAt).getTime();
          expect(startedTs).toBeLessThanOrEqual(finishedTs);
        }
      }
    }
  });

  it("ensures completed data jobs have rowsWritten > 0", () => {
    const completedJobs = mockDataJobs.filter((j) => j.status === "completed");
    expect(completedJobs.length).toBeGreaterThan(0);
    for (const job of completedJobs) {
      expect(job.rowsWritten).toBeGreaterThan(0);
    }
  });

  it("ensures audit actor is System or user with matching name", () => {
    for (const audit of mockAuditEntries) {
      if (audit.actorId === null) {
        expect(audit.actorName).toBe("System");
      } else {
        expect(audit.actorId).toBe(mockUser.id);
        expect(audit.actorName).toBe(mockUser.name);
      }
    }
  });

  it("ensures audit targetId resolves to a mock of its targetType (settings exempt)", () => {
    const brokerAccountIds = new Set(mockBrokerAccounts.map((b) => b.id));
    const strategyIds = new Set(mockStrategies.map((s) => s.id));
    const backtestRunIds = new Set(mockBacktestRuns.map((r) => r.id));
    const dataJobIds = new Set(mockDataJobs.map((j) => j.id));

    for (const audit of mockAuditEntries) {
      if (!audit.targetType || audit.targetType === "settings") {
        continue;
      }

      switch (audit.targetType) {
        case "user":
          expect(audit.targetId).toBe(mockUser.id);
          break;
        case "broker_account":
          expect(brokerAccountIds.has(audit.targetId as string)).toBe(true);
          break;
        case "strategy":
          expect(strategyIds.has(audit.targetId as string)).toBe(true);
          break;
        case "backtest":
          expect(backtestRunIds.has(audit.targetId as string)).toBe(true);
          break;
        case "data_job":
          expect(dataJobIds.has(audit.targetId as string)).toBe(true);
          break;
      }
    }
  });

  it("ensures audit entries are sorted newest first", () => {
    for (let i = 1; i < mockAuditEntries.length; i++) {
      const prev = new Date(mockAuditEntries[i - 1]?.at as string).getTime();
      const curr = new Date(mockAuditEntries[i]?.at as string).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it("ensures audit entry count is between 10 and 15 with at least 2 system entries", () => {
    expect(mockAuditEntries.length).toBeGreaterThanOrEqual(10);
    expect(mockAuditEntries.length).toBeLessThanOrEqual(15);
    const systemEntries = mockAuditEntries.filter((a) => a.actorId === null);
    expect(systemEntries.length).toBeGreaterThanOrEqual(2);
  });
});
