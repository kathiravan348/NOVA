import { describe, expect, it } from "vitest";
import { RecorderSettingsSchema, RecorderSettingsUpdateSchema } from "./recorder";

const settings = {
  enabled: true,
  symbols: ["INFY"],
  state: "recording",
  jobId: "job_1",
  updatedAt: "2026-09-25T03:45:00Z",
};

describe("recorder contracts", () => {
  it("accepts the setting and an update", () => {
    expect(RecorderSettingsSchema.parse(settings).state).toBe("recording");
    expect(RecorderSettingsUpdateSchema.parse({ enabled: false, symbols: [] }).enabled).toBe(false);
  });

  it.each([{ state: "paused" }, { symbols: ["infy"] }, { jobId: "" }])("rejects %o", (change) => {
    expect(RecorderSettingsSchema.safeParse({ ...settings, ...change }).success).toBe(false);
  });

  it("caps the stocks at Kite's limit", () => {
    const symbols = Array.from({ length: 3001 }, (_, i) => `S${i}`);
    expect(RecorderSettingsUpdateSchema.safeParse({ enabled: true, symbols }).success).toBe(false);
  });
});
