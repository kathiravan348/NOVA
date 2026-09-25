import { describe, expect, it } from "vitest";
import {
  BrokerAccount,
  BrokerAccountCreateSchema,
  BrokerAccountSchema,
  BrokerProfileSchema,
  type BrokerProfile,
  BrokerSchema,
  BrokerSession,
  BrokerSessionSchema,
  BrokerSessionStatusSchema,
} from "./broker";

describe("Broker schemas", () => {
  const validActiveSession: BrokerSession = {
    status: "active",
    loggedInAt: "2026-01-01T08:30:00Z",
    expiresAt: "2026-01-01T15:30:00Z",
  };

  const validNotLoggedInSession: BrokerSession = {
    status: "not_logged_in",
    loggedInAt: null,
    expiresAt: null,
  };

  const validAccount: BrokerAccount = {
    id: "acc-001",
    broker: "zerodha",
    label: "Family Primary Kite",
    clientId: "AB1234",
    enabled: true,
    session: validActiveSession,
    createdAt: "2026-01-01T00:00:00Z",
  };

  describe("BrokerSchema", () => {
    it("accepts 'zerodha'", () => {
      expect(BrokerSchema.safeParse("zerodha").success).toBe(true);
    });

    it("rejects invalid broker enum", () => {
      expect(BrokerSchema.safeParse("angelone").success).toBe(false);
    });
  });

  describe("BrokerSessionStatusSchema", () => {
    it("accepts valid statuses", () => {
      expect(BrokerSessionStatusSchema.safeParse("active").success).toBe(true);
      expect(BrokerSessionStatusSchema.safeParse("expired").success).toBe(true);
      expect(BrokerSessionStatusSchema.safeParse("not_logged_in").success).toBe(true);
    });

    it("rejects invalid status enum", () => {
      expect(BrokerSessionStatusSchema.safeParse("disconnected").success).toBe(false);
    });
  });

  describe("BrokerSessionSchema", () => {
    it("accepts a valid active session", () => {
      expect(BrokerSessionSchema.safeParse(validActiveSession).success).toBe(true);
    });

    it("accepts a valid not_logged_in session with null timestamps", () => {
      expect(BrokerSessionSchema.safeParse(validNotLoggedInSession).success).toBe(true);
    });

    it("accepts a valid expired session with both timestamps set", () => {
      const expiredSession: BrokerSession = {
        status: "expired",
        loggedInAt: "2026-01-01T08:30:00Z",
        expiresAt: "2026-01-01T15:30:00Z",
      };
      expect(BrokerSessionSchema.safeParse(expiredSession).success).toBe(true);
    });

    it("rejects not_logged_in when loggedInAt is set", () => {
      const invalid = {
        status: "not_logged_in",
        loggedInAt: "2026-01-01T08:30:00Z",
        expiresAt: null,
      };
      expect(BrokerSessionSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects not_logged_in when expiresAt is set", () => {
      const invalid = {
        status: "not_logged_in",
        loggedInAt: null,
        expiresAt: "2026-01-01T15:30:00Z",
      };
      expect(BrokerSessionSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects active when loggedInAt is null", () => {
      const invalid = {
        status: "active",
        loggedInAt: null,
        expiresAt: "2026-01-01T15:30:00Z",
      };
      expect(BrokerSessionSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects active when expiresAt is null", () => {
      const invalid = {
        status: "active",
        loggedInAt: "2026-01-01T08:30:00Z",
        expiresAt: null,
      };
      expect(BrokerSessionSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects when loggedInAt is greater than expiresAt", () => {
      const invalid = {
        status: "active",
        loggedInAt: "2026-01-01T16:00:00Z",
        expiresAt: "2026-01-01T09:00:00Z",
      };
      expect(BrokerSessionSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects when loggedInAt equals expiresAt", () => {
      const invalid = {
        status: "active",
        loggedInAt: "2026-01-01T09:00:00Z",
        expiresAt: "2026-01-01T09:00:00Z",
      };
      expect(BrokerSessionSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("BrokerAccountSchema", () => {
    it("accepts a valid broker account", () => {
      expect(BrokerAccountSchema.safeParse(validAccount).success).toBe(true);
    });

    it("rejects empty label", () => {
      const invalid = { ...validAccount, label: "" };
      expect(BrokerAccountSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects empty clientId", () => {
      const invalid = { ...validAccount, clientId: "" };
      expect(BrokerAccountSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects extra fields because of strictObject", () => {
      const invalid = { ...validAccount, apiKey: "secret-key" };
      expect(BrokerAccountSchema.safeParse(invalid).success).toBe(false);
    });
  });
});

describe("BrokerProfileSchema", () => {
  const profile: BrokerProfile = {
    broker: "zerodha",
    name: "Zerodha",
    api: "Kite Connect v3",
    plan: "Connect",
    subscriptionRenewsOn: "2026-12-01",
    apiKeyLast4: "x7Q2",
    redirectUrl: "https://nova.example/relay/callback",
    postbackUrl: null,
    staticIp: "203.0.113.25",
    sessionRule: "Daily login; token valid until 06:00 IST next day",
    links: [{ label: "API docs", url: "https://kite.trade/docs/connect/v3/", kind: "docs" }],
  };

  it("accepts a valid profile, with null optional fields", () => {
    expect(BrokerProfileSchema.parse(profile)).toEqual(profile);
    expect(
      BrokerProfileSchema.safeParse({ ...profile, subscriptionRenewsOn: null, staticIp: null })
        .success,
    ).toBe(true);
  });

  it("rejects a full API key and a bad IP", () => {
    expect(BrokerProfileSchema.safeParse({ ...profile, apiKeyLast4: "abcdef12" }).success).toBe(
      false,
    );
    expect(BrokerProfileSchema.safeParse({ ...profile, staticIp: "300.1.1.1" }).success).toBe(
      false,
    );
  });

  it("rejects non-https links, unknown link kinds and extra keys", () => {
    const link = profile.links[0]!;
    expect(
      BrokerProfileSchema.safeParse({ ...profile, links: [{ ...link, url: "http://kite.trade" }] })
        .success,
    ).toBe(false);
    expect(
      BrokerProfileSchema.safeParse({ ...profile, links: [{ ...link, kind: "video" }] }).success,
    ).toBe(false);
    expect(BrokerProfileSchema.safeParse({ ...profile, apiSecret: "s" }).success).toBe(false);
  });
});

describe("BrokerAccountCreateSchema", () => {
  const ok = { label: "Main", clientId: "AB1234" };

  it("accepts a label and a 4–12 character client ID", () => {
    expect(BrokerAccountCreateSchema.safeParse(ok).success).toBe(true);
    expect(BrokerAccountCreateSchema.safeParse({ ...ok, clientId: "ab12" }).success).toBe(true);
  });

  it("rejects a blank or long label, a bad client ID and extra fields", () => {
    expect(BrokerAccountCreateSchema.safeParse({ ...ok, label: "  " }).success).toBe(false);
    expect(BrokerAccountCreateSchema.safeParse({ ...ok, label: "x".repeat(61) }).success).toBe(
      false,
    );
    expect(BrokerAccountCreateSchema.safeParse({ ...ok, clientId: "AB-12" }).success).toBe(false);
    expect(BrokerAccountCreateSchema.safeParse({ ...ok, clientId: "ABC" }).success).toBe(false);
    expect(BrokerAccountCreateSchema.safeParse({ ...ok, enabled: false }).success).toBe(false);
  });
});
