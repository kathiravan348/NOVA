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

/** One stock of the list; `synced` = Kite knows it (it has an instrument token); `newListing` = a
 * sync added it after an earlier sync, e.g. an IPO (D56). */
export const UniverseEntrySchema = z.strictObject({
  ...UniverseEntryWriteSchema.shape,
  synced: z.boolean(),
  newListing: z.boolean(),
});
export type UniverseEntry = z.infer<typeof UniverseEntrySchema>;

/** One sector of the stock list and its stock count (`GET /market-data/universe/sectors`, D57). */
export const UniverseSectorSchema = z.strictObject({
  sector: z.string().min(1),
  count: z.number().int().min(1),
});
export type UniverseSector = z.infer<typeof UniverseSectorSchema>;
