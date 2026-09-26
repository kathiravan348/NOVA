import { describe, expect, it } from "vitest";
import type { BacktestProgress } from "@nova/contracts";
import { formatDuration, progressLine, runningFor, timeLeft } from "./progressText";

const base: BacktestProgress = {
  stage: "loading",
  percent: 10,
  symbolsDone: 12,
  symbolsTotal: 50,
  barsDone: 0,
  barsTotal: 0,
  tradesSoFar: 0,
  simulatedTo: null,
};

describe("progressLine", () => {
  it("says what each stage is doing", () => {
    expect(progressLine(base)).toBe("Loading prices — 12 of 50 stocks");
    expect(progressLine({ ...base, stage: "signals" })).toBe("Running your Python code");
    expect(
      progressLine({ ...base, stage: "simulating", simulatedTo: "2025-03-14", tradesSoFar: 37 }),
    ).toBe("Simulating — reached 14 Mar 2025 · 37 trades so far");
    expect(progressLine({ ...base, stage: "saving", tradesSoFar: 1_412 })).toBe(
      "Saving 1,412 trades",
    );
    expect(progressLine({ ...base, stage: "done" })).toBe("Finished");
  });

  it("uses Indian grouping and the singular", () => {
    expect(progressLine({ ...base, symbolsDone: 1, symbolsTotal: 1 })).toBe(
      "Loading prices — 1 of 1 stock",
    );
    expect(progressLine({ ...base, stage: "saving", tradesSoFar: 1_23_456 })).toBe(
      "Saving 1,23,456 trades",
    );
  });
});

describe("time", () => {
  const start = "2026-09-26T10:00:00Z";
  const at = (s: number) => new Date(Date.parse(start) + s * 1000);

  it("shows how long the run has been going", () => {
    expect(runningFor(start, at(130))).toBe("Running for 2 min 10 s");
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(3_900)).toBe("1 h 5 min");
  });

  it("guesses the time left only from 5% and 10 s", () => {
    expect(timeLeft(start, 4, at(600))).toBeNull();
    expect(timeLeft(start, 50, at(8))).toBeNull();
    expect(timeLeft(start, 40, at(120))).toBe("About 3 min left");
    expect(timeLeft(start, 90, at(60))).toBe("Less than a minute left");
    expect(timeLeft(start, 100, at(60))).toBeNull();
  });
});
