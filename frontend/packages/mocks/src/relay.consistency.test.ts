import { describe, expect, it } from "vitest";
import {
  MOCK_NOW,
  mockAuditEntries,
  mockBacktestRuns,
  mockBrokerAccounts,
  mockBrokerProfiles,
  mockDataJobs,
  mockRateLimits,
  mockStrategies,
  mockUser,
} from "./data";

describe("Relay rate limits v2 and broker profile", () => {
  const KITE: Record<string, Record<string, number>> = {
    quote: { second: 1 },
    historical: { second: 3 },
    orders: { second: 10, minute: 400, day: 5000 },
    other: { second: 10 },
  };

  it("broker limits are the Kite v3 values and NOVA limits keep usage within them", () => {
    for (const limit of mockRateLimits) {
      const expected = KITE[limit.endpoint]!;
      expect(limit.rules.map((r) => r.window).sort()).toEqual(Object.keys(expected).sort());
      for (const rule of limit.rules) {
        expect(rule.brokerLimit).toBe(expected[rule.window]);
        expect(rule.novaLimit).toBe(Math.max(1, Math.floor(rule.brokerLimit * 0.8)));
        expect(rule.used).toBeLessThanOrEqual(rule.novaLimit);
      }
    }
  });

  it("day windows reset at the next 00:00 IST after MOCK_NOW", () => {
    for (const rule of mockRateLimits.flatMap((l) => l.rules)) {
      if (rule.window === "day") expect(rule.resetsAt).toBe("2026-09-21T18:30:00Z");
    }
  });

  it("at least one enabled account passes 80% of a NOVA limit", () => {
    const hot = mockRateLimits.flatMap((l) => l.rules).filter((r) => r.used > r.novaLimit * 0.8);
    expect(hot.length).toBeGreaterThan(0);
  });

  it("sessions expire at 06:00 IST the day after login", () => {
    for (const b of mockBrokerAccounts) {
      if (!b.session.loggedInAt || !b.session.expiresAt) continue;
      const login = new Date(b.session.loggedInAt);
      const expected = new Date(
        Date.UTC(login.getUTCFullYear(), login.getUTCMonth(), login.getUTCDate() + 1, 0, 30),
      );
      expect(b.session.expiresAt).toBe(expected.toISOString().replace(".000Z", "Z"));
    }
  });

  it("broker profile shows only the last 4 key characters and https links", () => {
    expect(mockBrokerProfiles).toHaveLength(1);
    const json = JSON.stringify(mockBrokerProfiles);
    expect(json).not.toMatch(/secret|password/i);
    for (const link of mockBrokerProfiles[0]!.links)
      expect(link.url.startsWith("https://")).toBe(true);
  });
});

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
