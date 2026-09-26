import { z } from "zod";
import { DataJobSchema } from "./dataJob";

/** WebSocket `/api/v1/ws` messages from NOVA Core (D57). */
export const RealtimeMessageSchema = z.discriminatedUnion("type", [
  /** First message after the socket opens. */
  z.strictObject({ type: z.literal("hello") }),
  /** Every 25 s; answer `{ type: "pong" }`. */
  z.strictObject({ type: z.literal("ping") }),
  /** A data job was created or changed (any type). */
  z.strictObject({ type: z.literal("data_job.updated"), data: DataJobSchema }),
]);
export type RealtimeMessage = z.infer<typeof RealtimeMessageSchema>;
