import { describe, expect, it } from "vitest";
import type { DataJobPlan } from "@nova/contracts";
import { formatBytes, formatDuration, formatStart } from "./plan";

const plan: DataJobPlan = {
  steps: 2,
  skippedSteps: 0,
  requests: 2,
  estimatedRows: 10,
  estimatedBytes: 800,
  estimatedSeconds: 2,
  estimatedStartAt: "2026-09-24T05:10:00Z",
  jobsAhead: 0,
  perSymbol: [],
  warnings: [],
};

describe("plan formatting", () => {
  it("sizes in KB, MB and GB", () => {
    expect(formatBytes(800)).toBe("~1 KB");
    expect(formatBytes(9_400_000)).toBe("~9.4 MB");
    expect(formatBytes(2_500_000_000)).toBe("~2.5 GB");
  });

  it("durations in plain words", () => {
    expect(formatDuration(20)).toBe("less than a minute");
    expect(formatDuration(2100)).toBe("about 35 min");
    expect(formatDuration(5400)).toBe("about 1 h 30 min");
    expect(formatDuration(7200)).toBe("about 2 h");
  });

  it("start is now or after the jobs ahead", () => {
    const today = new Date("2026-09-24T04:00:00Z");
    expect(formatStart(plan, today)).toBe("Now");
    expect(formatStart({ ...plan, jobsAhead: 2 }, today)).toBe("After 2 jobs, ~10:40 IST");
    expect(formatStart({ ...plan, jobsAhead: 1 }, new Date("2026-09-23T04:00:00Z"))).toBe(
      "After 1 job, ~24 Sep, 10:40 IST",
    );
  });
});
