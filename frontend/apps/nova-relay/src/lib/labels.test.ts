import { describe, expect, it } from "vitest";
import {
  AuditActionSchema,
  DataJobStatusSchema,
  DataJobTypeSchema,
  RateLimitEndpointSchema,
} from "@nova/contracts";
import {
  AUDIT_GROUPS,
  auditActionLabel,
  auditGroup,
  auditGroupLabel,
  endpointLabel,
  jobStatusLabel,
  jobStatusTone,
  jobTypeLabel,
} from "./labels";
import { formatPeriod } from "./format";

describe("labels", () => {
  it("labels every enum value", () => {
    for (const v of RateLimitEndpointSchema.options) expect(endpointLabel[v]).toBeTruthy();
    for (const v of DataJobTypeSchema.options) expect(jobTypeLabel[v]).toBeTruthy();
    for (const v of DataJobStatusSchema.options) {
      expect(jobStatusLabel[v]).toBeTruthy();
      expect(jobStatusTone[v]).toBeTruthy();
    }
    for (const v of AuditActionSchema.options) {
      expect(auditActionLabel[v]).toBeTruthy();
      expect(AUDIT_GROUPS).toContain(auditGroup(v));
    }
    for (const g of AUDIT_GROUPS) expect(auditGroupLabel[g]).toBeTruthy();
  });

  it("groups audit actions by prefix", () => {
    expect(auditGroup("broker.session_expired")).toBe("broker");
    expect(auditGroup("data_job.cancel")).toBe("data_job");
  });

  it("formats periods", () => {
    expect(formatPeriod("2026-01-01", "2026-06-30")).toBe("1 Jan – 30 Jun 2026");
  });
});
