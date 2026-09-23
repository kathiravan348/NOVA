import { describe, expect, it } from "vitest";
import { MOCK_NOW } from "@nova/mocks";
import { DEMO_NOW, getNow } from "./clock";

describe("clock", () => {
  it("uses the mock data's now in mock mode", () => {
    expect(DEMO_NOW).toBe(MOCK_NOW);
    expect(getNow().toISOString()).toBe("2026-09-21T06:30:00.000Z");
  });
});
