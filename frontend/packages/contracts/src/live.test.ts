import { describe, expect, it } from "vitest";
import {
  LiveDaySummarySchema,
  LiveSnapshotItemSchema,
  LiveSubscribeSchema,
  LiveTickSchema,
} from "./live";
import { RealtimeMessageSchema } from "./realtime";
import ticks from "../../mocks/data/liveTicks.json";
import snapshots from "../../mocks/data/liveSnapshot.json";
import days from "../../mocks/data/liveDays.json";

describe("live contracts", () => {
  it("validates eight stocks and a stock with recorder gaps", () => {
    expect(LiveTickSchema.array().parse(ticks)).toHaveLength(8);
    expect(LiveSnapshotItemSchema.array().parse(snapshots)).toHaveLength(8);
    expect(
      LiveDaySummarySchema.array()
        .parse(days)
        .filter((row) => row.missingSeconds > 0)
        .every((row) => row.symbol === "TCS"),
    ).toBe(true);
    expect(RealtimeMessageSchema.parse({ type: "live.tick", data: ticks[0] }).type).toBe(
      "live.tick",
    );
  });
  it("supports replacing or clearing up to 500 subscriptions", () => {
    expect(
      LiveSubscribeSchema.parse({ type: "live.subscribe", symbols: ["M&M", "BAJAJ-AUTO"] }).symbols,
    ).toEqual(["M&M", "BAJAJ-AUTO"]);
    expect(LiveSubscribeSchema.parse({ type: "live.subscribe", symbols: [] }).symbols).toEqual([]);
    expect(
      LiveSubscribeSchema.parse({
        type: "live.subscribe",
        symbols: Array.from({ length: 500 }, (_, i) => `S${i}`),
      }).symbols,
    ).toHaveLength(500);
    for (const symbols of [
      ["INFY", "INFY"],
      ["../INFY"],
      Array.from({ length: 501 }, (_, i) => `S${i}`),
    ])
      expect(LiveSubscribeSchema.safeParse({ type: "live.subscribe", symbols }).success).toBe(
        false,
      );
  });
  it("rejects inconsistent counters and fractional paise", () => {
    expect(LiveTickSchema.safeParse({ ...ticks[0], price: 1.5 }).success).toBe(false);
    expect(LiveTickSchema.safeParse({ ...ticks[0], extra: true }).success).toBe(false);
    expect(LiveDaySummarySchema.safeParse({ ...days[0], missingSeconds: 1 }).success).toBe(false);
    expect(
      LiveSnapshotItemSchema.safeParse({ ...snapshots[0], secondsWithTick: 99_999 }).success,
    ).toBe(false);
  });
});
