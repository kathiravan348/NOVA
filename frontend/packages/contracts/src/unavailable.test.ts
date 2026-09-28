import { describe, expect, it } from "vitest";
import records from "../../mocks/data/unavailable.json";
import { UnavailableDaySchema } from "./unavailable";

describe("UnavailableDay", () => {
  it("validates the static unavailable and resolved examples", () => {
    expect(UnavailableDaySchema.array().parse(records)).toHaveLength(3);
  });
  it("rejects resolution without evidence, negative checks and extra fields", () => {
    const row = records[0];
    expect(UnavailableDaySchema.safeParse({ ...row, status: "resolved" }).success).toBe(false);
    expect(UnavailableDaySchema.safeParse({ ...row, attempts: 0 }).success).toBe(false);
    expect(UnavailableDaySchema.safeParse({ ...row, token: "not-allowed" }).success).toBe(false);
  });
});
