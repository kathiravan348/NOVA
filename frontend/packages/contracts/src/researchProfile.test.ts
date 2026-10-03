import { describe, expect, it } from "vitest";
import profiles from "../../mocks/data/researchProfiles.json";
import {
  DEFAULT_RESEARCH_SETTINGS,
  ResearchSettingsSchema,
  ResearchProfileSchema,
  ResearchProfileVersionSchema,
  ResearchProfileCreateSchema,
  ResearchProfileVersionCreateSchema,
  ResearchProfileVersionUpdateSchema,
} from "./researchProfile";

const badRelationships = [
  ["account", "reservePercent", 61, "Pools must sum to at most 100 percent"],
  ["account", "openRiskPercent", 0.05, "Open risk must be at least position risk"],
  ["execution", "stressDelayMs", 200, "Stress delay must be at least base delay"],
  ["execution", "stressSlippageTicks", 0, "Stress slippage must be at least base slippage"],
  ["signal", "maxStopAtr", 0.5, "Maximum stop ATR must exceed minimum stop ATR"],
  [
    "timing",
    "lastEntry",
    "09:30",
    "Entry times must satisfy earliestEntry < lastEntry < squareOff",
  ],
  [
    "timing",
    "squareOff",
    "14:30",
    "Entry times must satisfy earliestEntry < lastEntry < squareOff",
  ],
] as const;

function changed(group: string, field: string, value: unknown) {
  const settings: Record<string, Record<string, unknown>> = structuredClone(
    DEFAULT_RESEARCH_SETTINGS,
  );
  settings[group]![field] = value;
  return settings;
}

describe("research profile contracts", () => {
  it("validates defaults and matches the shared parity fixture", () => {
    expect(ResearchSettingsSchema.parse(DEFAULT_RESEARCH_SETTINGS)).toEqual(
      DEFAULT_RESEARCH_SETTINGS,
    );
    const profile = ResearchProfileSchema.parse(profiles[0]);
    expect(profile.versions[1]?.settings).toEqual(DEFAULT_RESEARCH_SETTINGS);
    expect(profile.versions.map((version) => version.version)).toEqual([2, 1]);
  });

  it.each(badRelationships)(
    "rejects %s.%s with the shared message",
    (group, field, value, message) => {
      const result = ResearchSettingsSchema.safeParse(changed(group, field, value));
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues.map((issue) => issue.message)).toContain(message);
    },
  );

  it.each([
    ["account", "initialPoolPercent", 0],
    ["account", "stockCapPercent", 101],
    ["account", "addPoolPercent", -1],
    ["account", "reservePercent", -1],
    ["account", "maxPositions", 21],
    ["account", "maxPositions", 1.5],
    ["account", "maxNewPositionsPerDay", 51],
    ["account", "lossStreakPause", 11],
    ["account", "riskPerPositionPercent", 5.1],
    ["account", "openRiskPercent", 10.1],
    ["account", "dailyLossPercent", 0],
    ["account", "cooldownMinutes", -1],
    ["execution", "delayMs", -1],
    ["execution", "stressDelayMs", 10001],
    ["execution", "slippageTicks", 21],
    ["execution", "maxQuoteAgeMs", 99],
    ["execution", "maxQuoteAgeMs", 60001],
    ["execution", "maxSpreadBps", 201],
    ["execution", "minFillPercent", 0],
    ["execution", "maxDepthPercent", 101],
    ["market", "marketGate", "true"],
    ["market", "marketIndex", "nifty 50"],
    ["market", "indexRangeMinutes", 0],
    ["signal", "minRelativeVolume", 0],
    ["signal", "volumeBaselineSessions", 4],
    ["signal", "volumeBaselineSessions", 61],
    ["signal", "atrPeriod", 1],
    ["signal", "atrPeriod", 51],
    ["signal", "contextEmaPeriod", 101],
    ["signal", "rangeSpanAtr", 21],
    ["timing", "earliestEntry", "09:14"],
    ["timing", "squareOff", "15:30"],
    ["timing", "earliestEntry", "9:30"],
    ["timing", "earliestEntry", "09:30\n"],
    ["timing", "maxHoldMinutes", 376],
    ["data", "maxSessionGapSeconds", 301],
    ["data", "maxSessionGapSeconds", -1],
  ])("rejects invalid %s.%s = %s", (group, field, value) => {
    expect(
      ResearchSettingsSchema.safeParse(changed(String(group), String(field), value)).success,
    ).toBe(false);
  });

  it("accepts optional zero pools, disabled loss pause and zero execution/data limits", () => {
    const settings = structuredClone(DEFAULT_RESEARCH_SETTINGS);
    settings.account.addPoolPercent = 0;
    settings.account.reservePercent = 0;
    settings.account.lossStreakPause = 0;
    settings.execution.delayMs = 0;
    settings.execution.slippageTicks = 0;
    settings.data.maxSessionGapSeconds = 0;
    expect(ResearchSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it("accepts decimal pools that add up to exactly 100", () => {
    const settings = structuredClone(DEFAULT_RESEARCH_SETTINGS);
    settings.account.initialPoolPercent = 33.3;
    settings.account.addPoolPercent = 33.3;
    settings.account.reservePercent = 33.4;
    expect(ResearchSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it.each(["account", "execution", "market", "signal", "timing", "data"])(
    "rejects extra fields in %s",
    (group) => {
      expect(ResearchSettingsSchema.safeParse(changed(group, "unknown", true)).success).toBe(false);
    },
  );

  it("rejects extras on every wire model", () => {
    const settings = DEFAULT_RESEARCH_SETTINGS;
    const version = profiles[0]!.versions[0]!;
    const cases = [
      [ResearchSettingsSchema, settings],
      [ResearchProfileSchema, profiles[0]!],
      [ResearchProfileVersionSchema, version],
      [ResearchProfileCreateSchema, { name: "Plan", description: "", settings }],
      [ResearchProfileVersionCreateSchema, { note: "", settings }],
      [ResearchProfileVersionUpdateSchema, { settings }],
    ] as const;
    for (const [schema, body] of cases)
      expect(schema.safeParse({ ...body, unknown: true }).success).toBe(false);
  });

  it("checks version order, hash syntax and the frozen/draft invariants", () => {
    const profile = profiles[0]!;
    const draft = profile.versions[0]!;
    expect(
      ResearchProfileSchema.safeParse({ ...profile, versions: [...profile.versions].reverse() })
        .success,
    ).toBe(false);
    expect(ResearchProfileSchema.safeParse({ ...profile, versions: [draft, draft] }).success).toBe(
      false,
    );
    for (const update of [
      { version: 0 },
      { hash: "a".repeat(64) },
      { frozenAt: draft.createdAt },
      { frozen: true },
      { frozen: true, hash: "invalid", frozenAt: draft.createdAt },
    ]) {
      expect(ResearchProfileVersionSchema.safeParse({ ...draft, ...update }).success).toBe(false);
    }
  });
});
