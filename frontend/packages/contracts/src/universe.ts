import { z } from "zod";
import { IndexNameSchema } from "./strategy";

/** Stock symbols as NSE writes them, e.g. `INFY`, `M&M`, `BAJAJ-AUTO`. */
export const UniverseSymbolSchema = z
  .string()
  .regex(/^[A-Z0-9&-]{1,20}$/, "1–20 capital letters, digits, & or -");

const text80 = (what: string) =>
  z.string().max(80, "At most 80 characters").regex(/\S/, `Enter the ${what}`);

/** Body of `POST /market-data/universe` and `PUT /market-data/universe/{symbol}` (D54). */
export const UniverseEntryWriteSchema = z.strictObject({
  symbol: UniverseSymbolSchema,
  name: text80("company name"),
  sector: text80("sector"),
  indices: z.array(IndexNameSchema),
});
export type UniverseEntryWrite = z.infer<typeof UniverseEntryWriteSchema>;

/** One stock of the list; `synced` = Kite knows it (it has an instrument token). */
export const UniverseEntrySchema = z.strictObject({
  ...UniverseEntryWriteSchema.shape,
  synced: z.boolean(),
});
export type UniverseEntry = z.infer<typeof UniverseEntrySchema>;

/** Response of `POST /market-data/instruments/sync`. */
export const InstrumentSyncResultSchema = z.strictObject({
  synced: z.array(UniverseSymbolSchema),
  missing: z.array(UniverseSymbolSchema),
});
export type InstrumentSyncResult = z.infer<typeof InstrumentSyncResultSchema>;
