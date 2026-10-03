import { z } from "zod";
import { ChargesSchema } from "./charges";
import {
  ExchangeSchema,
  IdSchema,
  PaiseSchema,
  SegmentSchema,
  SideSchema,
  UtcDateTimeSchema,
} from "./common";

export const ExitReasonSchema = z.enum([
  "signal",
  "stop",
  "target",
  "time_exit",
  "square_off",
  "market_filter",
  "rotation",
  "end_of_period",
]);
export type ExitReason = z.infer<typeof ExitReasonSchema>;

export const TradeSchema = z
  .strictObject({
    id: IdSchema,
    runId: IdSchema,
    symbol: z.string().min(1),
    exchange: ExchangeSchema,
    segment: SegmentSchema,
    side: SideSchema,
    qty: z.number().int().positive(),
    entryAt: UtcDateTimeSchema,
    entryPricePaise: z.number().int().positive(),
    exitAt: UtcDateTimeSchema.nullable(),
    exitPricePaise: z.number().int().positive().nullable(),
    exitReason: ExitReasonSchema.nullable().default(null),
    grossPnlPaise: PaiseSchema,
    charges: ChargesSchema,
    netPnlPaise: PaiseSchema,
  })
  .refine((data) => data.netPnlPaise === data.grossPnlPaise - data.charges.totalPaise, {
    message: "netPnlPaise must equal grossPnlPaise minus charges.totalPaise",
    path: ["netPnlPaise"],
  })
  .refine(
    (data) =>
      (data.exitAt === null && data.exitPricePaise === null) ||
      (data.exitAt !== null && data.exitPricePaise !== null),
    {
      message: "exitAt and exitPricePaise must both be null or both be provided",
      path: ["exitAt"],
    },
  );

export type Trade = z.infer<typeof TradeSchema>;
