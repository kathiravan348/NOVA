import { z } from "zod";
import { IdSchema, UtcDateTimeSchema } from "./common";
import { UniverseSymbolSchema } from "./universe";

/** Kite streams at most this many instruments over one WebSocket. */
export const MAX_RECORDER_SYMBOLS = 3000;

/**
 * `off`; `waiting` (outside 09:15–15:30 IST on weekdays); `recording` (`jobId` is the running
 * `tick_record` job); `no_login` (market hours but no live Kite session).
 */
export const RecorderStateSchema = z.enum(["off", "waiting", "recording", "no_login"]);
export type RecorderState = z.infer<typeof RecorderStateSchema>;

/** Body of `PUT /broker/recorder` (D54). `symbols` empty = every stock synced with Kite. */
export const RecorderSettingsUpdateSchema = z.strictObject({
  enabled: z.boolean(),
  symbols: z
    .array(UniverseSymbolSchema)
    .max(MAX_RECORDER_SYMBOLS, `At most ${MAX_RECORDER_SYMBOLS} stocks`),
});
export type RecorderSettingsUpdate = z.infer<typeof RecorderSettingsUpdateSchema>;

export const RecorderSettingsSchema = z.strictObject({
  ...RecorderSettingsUpdateSchema.shape,
  state: RecorderStateSchema,
  jobId: IdSchema.nullable(),
  updatedAt: UtcDateTimeSchema,
});
export type RecorderSettings = z.infer<typeof RecorderSettingsSchema>;
