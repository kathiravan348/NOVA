import { describe, expect, it } from "vitest";
import { DataJobSchema, InstrumentSyncResultSchema } from "./dataJob";
const historical = {
  id: "job_150",
  type: "historical_download",
  status: "completed",
  exchange: "NSE",
  segment: "equity_delivery",
  symbols: ["INFY"],
  timeframe: "1d",
  from: "2026-09-01",
  to: "2026-09-30",
  progressPercent: 100,
  rowsWritten: 1,
  createdAt: "2026-09-30T06:00:00Z",
  startedAt: "2026-09-30T06:00:00Z",
  finishedAt: "2026-09-30T06:01:00Z",
  error: null,
  summary: null,
  mode: null,
  plan: null,
  stepsDone: 0,
  stepsTotal: 0,
  expiresAt: null,
};
describe("Instrument sync result", () => {
  it("validates a sync result and forbids it on other or unfinished jobs", () => {
    const result = {
      newSymbols: ["NEWCO"],
      newIndexMembers: [{ symbol: "INFY", index: "NIFTY IT" }],
    };
    expect(InstrumentSyncResultSchema.parse(result)).toEqual(result);
    expect(InstrumentSyncResultSchema.safeParse({ ...result, extra: true }).success).toBe(false);
    expect(
      InstrumentSyncResultSchema.safeParse({
        ...result,
        newIndexMembers: [{ symbol: "INFY", index: "" }],
      }).success,
    ).toBe(false);
    expect(DataJobSchema.safeParse({ ...historical, syncResult: result }).success).toBe(false);
    const sync = {
      ...historical,
      type: "instrument_sync",
      symbols: [],
      syncResult: result,
    };
    expect(DataJobSchema.safeParse(sync).success).toBe(true);
    expect(DataJobSchema.safeParse({ ...sync, status: "running" }).success).toBe(false);
  });
});
