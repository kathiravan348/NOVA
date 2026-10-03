import { describe, expect, it } from "vitest";
import { heldTime } from "./heldTime";

describe("heldTime", () => {
  it.each([
    ["2026-06-02T04:00:00Z", "2026-06-02T04:00:00Z", "0 s"],
    ["2026-06-02T04:00:00Z", "2026-06-02T04:00:42Z", "42 s"],
    ["2026-06-02T04:00:00Z", "2026-06-02T04:01:00Z", "1 min"],
    ["2026-06-02T04:00:00Z", "2026-06-02T04:01:30Z", "1 min 30 s"],
    ["2026-06-02T04:00:00Z", "2026-06-02T04:12:00Z", "12 min"],
    ["2026-06-02T04:00:00Z", "2026-06-02T05:00:00Z", "1 h"],
    ["2026-06-02T04:00:00Z", "2026-06-02T06:05:59Z", "2 h 5 min"],
    // 18:00 UTC is 23:30 IST; 18:40 UTC is 00:10 IST the next day.
    ["2026-06-02T18:00:00Z", "2026-06-02T18:40:00Z", "1 day"],
    ["2026-06-05T09:50:00Z", "2026-06-08T03:45:00Z", "3 days"],
  ])("%s → %s is %s", (entryAt, at, expected) => {
    expect(heldTime(entryAt, at)).toBe(expected);
  });
});
