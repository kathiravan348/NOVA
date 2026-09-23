import { z } from "zod";
import {
  ExchangeSchema,
  IsoDateSchema,
  SegmentSchema,
  TimeframeSchema,
  UtcDateTimeSchema,
} from "./common";
import { IndexNameSchema } from "./strategy";

export const InstrumentSchema = z
  .strictObject({
    symbol: z.string().min(1),
    name: z.string().min(1),
    exchange: ExchangeSchema,
    segment: SegmentSchema,
    sector: z.string().min(1),
    indices: z.array(IndexNameSchema),
    lastClosePaise: z.number().int().positive(),
    high52wPaise: z.number().int().positive(),
    low52wPaise: z.number().int().positive(),
    changePercent: z.number(),
    avgDailyVolume: z.number().int().min(0),
    lotSize: z.number().int().positive().nullable(),
    timeframes: z.array(TimeframeSchema).min(1),
    dataFrom: IsoDateSchema,
    dataTo: IsoDateSchema,
  })
  .refine((i) => new Set(i.timeframes).size === i.timeframes.length, {
    message: "timeframes must be unique",
    path: ["timeframes"],
  })
  .refine((i) => i.dataFrom <= i.dataTo, {
    message: "dataFrom must be on or before dataTo",
    path: ["dataFrom"],
  })
  .refine((i) => new Set(i.indices).size === i.indices.length, {
    message: "indices must be unique",
    path: ["indices"],
  })
  .refine((i) => i.low52wPaise <= i.lastClosePaise && i.lastClosePaise <= i.high52wPaise, {
    message: "lastClosePaise must be between low52wPaise and high52wPaise",
    path: ["lastClosePaise"],
  });
export type Instrument = z.infer<typeof InstrumentSchema>;

const PricePaiseSchema = z.number().int().positive();

/** One OHLC bar. `time` is `YYYY-MM-DD` for `1d`, UTC ISO datetime for intraday (D17). */
export const CandleSchema = z
  .strictObject({
    time: z.union([IsoDateSchema, UtcDateTimeSchema]),
    openPaise: PricePaiseSchema,
    highPaise: PricePaiseSchema,
    lowPaise: PricePaiseSchema,
    closePaise: PricePaiseSchema,
    volume: z.number().int().min(0),
  })
  .refine((c) => c.highPaise >= Math.max(c.openPaise, c.closePaise), {
    message: "highPaise must be at least open and close",
    path: ["highPaise"],
  })
  .refine((c) => c.lowPaise <= Math.min(c.openPaise, c.closePaise), {
    message: "lowPaise must be at most open and close",
    path: ["lowPaise"],
  });
export type Candle = z.infer<typeof CandleSchema>;
