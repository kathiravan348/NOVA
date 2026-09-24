import { z } from "zod";

export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

export const UtcDateTimeSchema = z.iso.datetime();
export type UtcDateTime = z.infer<typeof UtcDateTimeSchema>;

export const IsoDateSchema = z.iso.date();
export type IsoDate = z.infer<typeof IsoDateSchema>;

export const PaiseSchema = z.number().int();
export type Paise = z.infer<typeof PaiseSchema>;

export const NonNegPaiseSchema = z.number().int().min(0);
export type NonNegPaise = z.infer<typeof NonNegPaiseSchema>;

export const SegmentSchema = z.enum(["equity_delivery", "equity_intraday", "futures", "options"]);
export type Segment = z.infer<typeof SegmentSchema>;

export const ExchangeSchema = z.enum(["NSE", "NFO"]);
export type Exchange = z.infer<typeof ExchangeSchema>;

export const TimeframeSchema = z.enum(["1m", "3m", "5m", "15m", "30m", "1h", "1d"]);
export type Timeframe = z.infer<typeof TimeframeSchema>;

export const SideSchema = z.enum(["buy", "sell"]);
export type Side = z.infer<typeof SideSchema>;

/** Page size bounds for paginated lists (D32). */
export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX = 200;
export const PageLimitSchema = z.number().int().min(1).max(PAGE_LIMIT_MAX);

/** Opaque cursor: clients pass back `nextCursor` unchanged. */
export const CursorSchema = z.string().min(1);

/** One page of a growing list (D32): `nextCursor` is `null` on the last page. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({ items: z.array(item), nextCursor: CursorSchema.nullable() });
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Query parameters of every paginated list. */
export interface PageQuery {
  limit?: number;
  cursor?: string;
}
