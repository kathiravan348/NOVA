import { z } from "zod";
import { IsoDateSchema, UtcDateTimeSchema } from "./common";

export const MAX_LIVE_SYMBOLS = 500;
export const LiveSymbolSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Z0-9&]+(?:-[A-Z0-9&]+)*$/);
export const LiveSymbolsSchema = z
  .array(LiveSymbolSchema)
  .max(MAX_LIVE_SYMBOLS)
  .refine((symbols) => new Set(symbols).size === symbols.length, "symbols must be unique");
export const LiveSubscribeSchema = z.strictObject({
  type: z.literal("live.subscribe"),
  symbols: LiveSymbolsSchema,
});
export type LiveSubscribe = z.infer<typeof LiveSubscribeSchema>;

/** Prices are integer paise. Unknown previous close gives a null percentage. */
export const LiveTickSchema = z.strictObject({
  symbol: LiveSymbolSchema,
  price: z.number().int().positive(),
  changePercent: z.number().nullable(),
  at: UtcDateTimeSchema,
  ticksThisSecond: z.number().int().positive(),
});
export type LiveTick = z.infer<typeof LiveTickSchema>;

export const LiveSnapshotItemSchema = z
  .strictObject({
    symbol: LiveSymbolSchema,
    price: z.number().int().positive().nullable(),
    changePercent: z.number().nullable(),
    at: UtcDateTimeSchema.nullable(),
    secondsWithTick: z.number().int().nonnegative(),
    secondsExpected: z.number().int().nonnegative().max(22_500),
  })
  .refine((row) => row.secondsWithTick <= row.secondsExpected, "seconds exceed the session")
  .refine((row) => (row.price === null) === (row.at === null), "price and at must agree");
export type LiveSnapshotItem = z.infer<typeof LiveSnapshotItemSchema>;

/** Computed 1-second candles; missingSeconds counts faults, noTradeSeconds counts shared silence. */
export const LiveDaySummarySchema = z
  .strictObject({
    symbol: LiveSymbolSchema,
    day: IsoDateSchema,
    tickCount: z.number().int().nonnegative(),
    candleCount: z.number().int().nonnegative(),
    secondsExpected: z.number().int().nonnegative().max(22_500),
    missingSeconds: z.number().int().nonnegative(),
    noTradeSeconds: z.number().int().nonnegative(),
    sizeBytes: z.number().int().nonnegative(),
  })
  .refine(
    (row) => row.candleCount + row.missingSeconds + row.noTradeSeconds === row.secondsExpected,
    "second counts must equal secondsExpected",
  )
  .refine((row) => row.candleCount <= row.tickCount, "candles exceed ticks");
export type LiveDaySummary = z.infer<typeof LiveDaySummarySchema>;
