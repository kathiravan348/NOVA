import { describe, expect, it } from "vitest";
import {
  AuditActionSchema,
  AuditEntry,
  AuditEntrySchema,
  AuditTargetTypeSchema,
} from "./audit";

describe("Audit schemas", () => {
  const validEntryWithTarget: AuditEntry = {
    id: "aud-001",
    at: "2026-01-01T10:00:00Z",
    actorId: "usr-001",
    actorName: "Super Admin",
    action: "broker.login",
    targetType: "broker_account",
    targetId: "acc-001",
    summary: "Logged in to Zerodha account AB1234",
    ip: "203.0.113.195",
  };

  const validSystemEntryWithoutTarget: AuditEntry = {
    id: "aud-002",
    at: "2026-01-01T10:05:00Z",
    actorId: null,
    actorName: "System",
    action: "broker.session_expired",
    targetType: null,
    targetId: null,
    summary: "Session expired automatically",
    ip: null,
  };

  describe("AuditActionSchema", () => {
    it("accepts valid actions", () => {
      expect(AuditActionSchema.safeParse("auth.login").success).toBe(true);
      expect(AuditActionSchema.safeParse("broker.session_expired").success).toBe(true);
      expect(AuditActionSchema.safeParse("data_job.create").success).toBe(true);
    });

    it("rejects invalid action enum", () => {
      expect(AuditActionSchema.safeParse("order.place").success).toBe(false);
    });
  });

  describe("AuditTargetTypeSchema", () => {
    it("accepts valid target types", () => {
      expect(AuditTargetTypeSchema.safeParse("user").success).toBe(true);
      expect(AuditTargetTypeSchema.safeParse("broker_account").success).toBe(true);
      expect(AuditTargetTypeSchema.safeParse("strategy").success).toBe(true);
    });

    it("rejects invalid target type enum", () => {
      expect(AuditTargetTypeSchema.safeParse("portfolio").success).toBe(false);
    });
  });

  describe("AuditEntrySchema", () => {
    it("accepts a valid entry with actor and target", () => {
      expect(AuditEntrySchema.safeParse(validEntryWithTarget).success).toBe(true);
    });

    it("accepts a valid system entry without target", () => {
      expect(AuditEntrySchema.safeParse(validSystemEntryWithoutTarget).success).toBe(true);
    });

    it("rejects when targetType is set but targetId is null", () => {
      const invalid = {
        ...validEntryWithTarget,
        targetType: "broker_account",
        targetId: null,
      };
      expect(AuditEntrySchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects when targetType is null but targetId is set", () => {
      const invalid = {
        ...validEntryWithTarget,
        targetType: null,
        targetId: "acc-001",
      };
      expect(AuditEntrySchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects empty actorName", () => {
      const invalid = { ...validEntryWithTarget, actorName: "" };
      expect(AuditEntrySchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects empty summary", () => {
      const invalid = { ...validEntryWithTarget, summary: "" };
      expect(AuditEntrySchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects extra fields because of strictObject", () => {
      const invalid = { ...validEntryWithTarget, extraProp: 123 };
      expect(AuditEntrySchema.safeParse(invalid).success).toBe(false);
    });
  });
});
