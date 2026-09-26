import { describe, expect, it } from "vitest";
import type { DataJob } from "./dataJob";
import { RealtimeMessageSchema } from "./realtime";

const job: DataJob = {
  id: "job-001",
  type: "historical_download",
  status: "running",
  exchange: "NSE",
  segment: "equity_delivery",
  symbols: ["RELIANCE"],
  timeframe: "1d",
  from: "2025-01-01",
  to: "2025-01-31",
  progressPercent: 40,
  rowsWritten: 12,
  createdAt: "2026-01-01T06:00:00Z",
  startedAt: "2026-01-01T06:01:00Z",
  finishedAt: null,
  error: null,
  summary: null,
  mode: null,
  plan: null,
  stepsDone: 0,
  stepsTotal: 0,
  expiresAt: null,
};

describe("RealtimeMessageSchema", () => {
  it("accepts hello, ping and a data job update", () => {
    expect(RealtimeMessageSchema.parse({ type: "hello" })).toEqual({ type: "hello" });
    expect(RealtimeMessageSchema.parse({ type: "ping" })).toEqual({ type: "ping" });
    expect(RealtimeMessageSchema.parse({ type: "data_job.updated", data: job })).toEqual({
      type: "data_job.updated",
      data: job,
    });
  });

  it("rejects unknown types, extra fields and missing data", () => {
    expect(RealtimeMessageSchema.safeParse({ type: "pong" }).success).toBe(false);
    expect(RealtimeMessageSchema.safeParse({ type: "hello", extra: 1 }).success).toBe(false);
    expect(RealtimeMessageSchema.safeParse({ type: "data_job.updated" }).success).toBe(false);
  });
});
