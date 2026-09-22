import { z } from "zod";
import {
  ExchangeSchema,
  IsoDateSchema,
  SegmentSchema,
  TimeframeSchema,
  UtcDateTimeSchema,
} from "./common";

export const InstrumentSchema = z
  .strictObject({
    symbol: z.string().min(1),
    name: z.string().min(1),
    exchange: ExchangeSchema,
    segment: SegmentSchema,
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
