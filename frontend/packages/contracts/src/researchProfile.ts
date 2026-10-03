import { z } from "zod";
import { IdSchema, UtcDateTimeSchema } from "./common";
import { IndexNameSchema } from "./strategy";

const percent = z.number().positive().max(100);
const optionalPercent = z.number().min(0).max(100);
const atrMultiple = z.number().positive().max(20);
const time = z
  .string()
  .length(5)
  .regex(
    /^(09:(1[5-9]|[2-5][0-9])|1[0-4]:[0-5][0-9]|15:[01][0-9]|15:2[0-9])$/,
    "Time must be HH:MM between 09:15 and 15:29 IST",
  );

export const ResearchSettingsSchema = z
  .strictObject({
    account: z.strictObject({
      initialPoolPercent: percent,
      addPoolPercent: optionalPercent,
      reservePercent: optionalPercent,
      stockCapPercent: percent,
      sectorCapPercent: percent,
      maxPositions: z.number().int().min(1).max(20),
      riskPerPositionPercent: z.number().positive().max(5),
      openRiskPercent: z.number().positive().max(10),
      dailyLossPercent: z.number().positive().max(10),
      lossStreakPause: z.number().int().min(0).max(10),
      maxNewPositionsPerDay: z.number().int().min(1).max(50),
      cooldownMinutes: z.number().int().min(0),
    }),
    execution: z.strictObject({
      delayMs: z.number().int().min(0).max(10_000),
      stressDelayMs: z.number().int().min(0).max(10_000),
      slippageTicks: z.number().int().min(0).max(20),
      stressSlippageTicks: z.number().int().min(0).max(20),
      maxQuoteAgeMs: z.number().int().min(100).max(60_000),
      maxSpreadBps: z.number().positive().max(200),
      maxSpreadToStopPercent: percent,
      maxDepthPercent: percent,
      minFillPercent: percent,
    }),
    market: z.strictObject({
      marketGate: z.boolean(),
      marketIndex: IndexNameSchema,
      indexRangeMinutes: z.number().int().positive(),
      declineVetoPercent: percent,
    }),
    signal: z.strictObject({
      minRelativeVolume: z.number().positive(),
      volumeBaselineSessions: z.number().int().min(5).max(60),
      minStopAtr: atrMultiple,
      maxStopAtr: atrMultiple,
      atrPeriod: z.number().int().min(2).max(50),
      contextEmaPeriod: z.number().int().min(2).max(100),
      rangeSpanAtr: atrMultiple,
    }),
    timing: z.strictObject({
      earliestEntry: time,
      lastEntry: time,
      squareOff: time,
      maxHoldMinutes: z.number().int().min(1).max(375),
    }),
    data: z.strictObject({ maxSessionGapSeconds: z.number().int().min(0).max(300) }),
  })
  .superRefine((settings, ctx) => {
    const { account, execution, signal, timing } = settings;
    const check = (valid: boolean, path: string[], message: string) => {
      if (!valid) ctx.addIssue({ code: "custom", path, message });
    };
    check(
      account.initialPoolPercent + account.addPoolPercent + account.reservePercent <= 100,
      ["account", "reservePercent"],
      "Pools must sum to at most 100 percent",
    );
    check(
      account.openRiskPercent >= account.riskPerPositionPercent,
      ["account", "openRiskPercent"],
      "Open risk must be at least position risk",
    );
    check(
      execution.stressDelayMs >= execution.delayMs,
      ["execution", "stressDelayMs"],
      "Stress delay must be at least base delay",
    );
    check(
      execution.stressSlippageTicks >= execution.slippageTicks,
      ["execution", "stressSlippageTicks"],
      "Stress slippage must be at least base slippage",
    );
    check(
      signal.maxStopAtr > signal.minStopAtr,
      ["signal", "maxStopAtr"],
      "Maximum stop ATR must exceed minimum stop ATR",
    );
    check(
      timing.earliestEntry < timing.lastEntry && timing.lastEntry < timing.squareOff,
      ["timing", "lastEntry"],
      "Entry times must satisfy earliestEntry < lastEntry < squareOff",
    );
  });
export type ResearchSettings = z.infer<typeof ResearchSettingsSchema>;

export const DEFAULT_RESEARCH_SETTINGS: ResearchSettings = {
  account: {
    initialPoolPercent: 30,
    addPoolPercent: 10,
    reservePercent: 60,
    stockCapPercent: 15,
    sectorCapPercent: 20,
    maxPositions: 3,
    riskPerPositionPercent: 0.1,
    openRiskPercent: 0.2,
    dailyLossPercent: 0.3,
    lossStreakPause: 2,
    maxNewPositionsPerDay: 5,
    cooldownMinutes: 15,
  },
  execution: {
    delayMs: 250,
    stressDelayMs: 1000,
    slippageTicks: 1,
    stressSlippageTicks: 3,
    maxQuoteAgeMs: 1500,
    maxSpreadBps: 8,
    maxSpreadToStopPercent: 10,
    maxDepthPercent: 10,
    minFillPercent: 25,
  },
  market: {
    marketGate: true,
    marketIndex: "NIFTY 50",
    indexRangeMinutes: 15,
    declineVetoPercent: 0.3,
  },
  signal: {
    minRelativeVolume: 1.2,
    volumeBaselineSessions: 20,
    minStopAtr: 0.5,
    maxStopAtr: 2.5,
    atrPeriod: 14,
    contextEmaPeriod: 20,
    rangeSpanAtr: 3,
  },
  timing: { earliestEntry: "09:30", lastEntry: "14:30", squareOff: "15:20", maxHoldMinutes: 60 },
  data: { maxSessionGapSeconds: 30 },
};

export const ResearchProfileVersionSchema = z
  .strictObject({
    version: z.number().int().min(1),
    note: z.string(),
    settings: ResearchSettingsSchema,
    frozen: z.boolean(),
    hash: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/)
      .nullable(),
    createdAt: UtcDateTimeSchema,
    frozenAt: UtcDateTimeSchema.nullable(),
  })
  .superRefine((version, ctx) => {
    if (version.frozen !== (version.hash !== null))
      ctx.addIssue({
        code: "custom",
        path: ["hash"],
        message: "Hash must be present exactly when frozen",
      });
    if (version.frozen !== (version.frozenAt !== null))
      ctx.addIssue({
        code: "custom",
        path: ["frozenAt"],
        message: "Frozen time must be present exactly when frozen",
      });
  });
export type ResearchProfileVersion = z.infer<typeof ResearchProfileVersionSchema>;

export const ResearchProfileSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string().min(1),
    description: z.string(),
    versions: z.array(ResearchProfileVersionSchema).min(1),
    createdAt: UtcDateTimeSchema,
    updatedAt: UtcDateTimeSchema,
  })
  .refine(
    (profile) =>
      profile.versions.every(
        (version, i) => i === 0 || profile.versions[i - 1]!.version > version.version,
      ),
    { path: ["versions"], message: "Versions must be newest first and unique" },
  );
export type ResearchProfile = z.infer<typeof ResearchProfileSchema>;

export const ResearchProfileCreateSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string(),
  settings: ResearchSettingsSchema,
});
export type ResearchProfileCreate = z.infer<typeof ResearchProfileCreateSchema>;
export const ResearchProfileVersionCreateSchema = z.strictObject({
  note: z.string(),
  settings: ResearchSettingsSchema,
});
export type ResearchProfileVersionCreate = z.infer<typeof ResearchProfileVersionCreateSchema>;
export const ResearchProfileVersionUpdateSchema = z.strictObject({
  settings: ResearchSettingsSchema,
});
export type ResearchProfileVersionUpdate = z.infer<typeof ResearchProfileVersionUpdateSchema>;
