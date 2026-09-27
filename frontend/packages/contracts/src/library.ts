import { z } from "zod";
import { BacktestBenchmarkSchema } from "./backtest";
import { IsoDateSchema } from "./common";
import { StrategySpecSchema, UniverseSchema } from "./strategy";

/** Strategy library (D62 (7)): 60 ready strategies in 7 families, added from Orbit's Library page. */
export const LibraryFamilyIdSchema = z.enum([
  "momentum_rotation",
  "trend",
  "pullback",
  "pattern",
  "low_turnover",
  "baseline",
  "intraday",
]);
export type LibraryFamilyId = z.infer<typeof LibraryFamilyIdSchema>;

/** "A01" … "G10". */
export const LibraryEntryIdSchema = z.string().regex(/^[A-G][0-9]{2}$/);

export const LibraryFamilySchema = z.strictObject({
  id: LibraryFamilyIdSchema,
  name: z.string().min(1),
  idea: z.string().min(1),
  watch: z.string().min(1),
});
export type LibraryFamily = z.infer<typeof LibraryFamilySchema>;

/** The suggested first backtest of an entry (the Library's Backtest button). */
export const LibraryBacktestSchema = z
  .strictObject({
    universe: UniverseSchema,
    from: IsoDateSchema,
    to: IsoDateSchema,
    initialCapitalPaise: z.number().int().positive(),
    benchmark: BacktestBenchmarkSchema.nullable(),
  })
  .refine((data) => data.from <= data.to, {
    message: "from date must be less than or equal to to date",
    path: ["from"],
  });
export type LibraryBacktest = z.infer<typeof LibraryBacktestSchema>;

export const LibraryEntrySchema = z.strictObject({
  id: LibraryEntryIdSchema,
  family: LibraryFamilyIdSchema,
  name: z.string().min(1),
  summary: z.string().min(1).max(140),
  spec: StrategySpecSchema,
  backtest: LibraryBacktestSchema,
});
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>;

/** `GET /strategies/library`. */
export const StrategyLibrarySchema = z.strictObject({
  families: z.array(LibraryFamilySchema),
  entries: z.array(LibraryEntrySchema),
});
export type StrategyLibrary = z.infer<typeof StrategyLibrarySchema>;

/** Body of `POST /strategies/library/install`: entry ids, each once; answers the new drafts. */
export const LibraryInstallSchema = z
  .strictObject({ ids: z.array(LibraryEntryIdSchema).min(1).max(100) })
  .refine((body) => new Set(body.ids).size === body.ids.length, {
    message: "Each id may appear once",
    path: ["ids"],
  });
export type LibraryInstall = z.infer<typeof LibraryInstallSchema>;
