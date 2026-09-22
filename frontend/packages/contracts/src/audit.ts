import { z } from "zod";
import { IdSchema, UtcDateTimeSchema } from "./common";

export const AuditActionSchema = z.enum([
  "auth.login",
  "auth.logout",
  "broker.login",
  "broker.session_expired",
  "strategy.create",
  "strategy.update",
  "backtest.run",
  "data_job.create",
  "data_job.cancel",
  "settings.update",
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditTargetTypeSchema = z.enum([
  "user",
  "broker_account",
  "strategy",
  "backtest",
  "data_job",
  "settings",
]);
export type AuditTargetType = z.infer<typeof AuditTargetTypeSchema>;

export const AuditEntrySchema = z
  .strictObject({
    id: IdSchema,
    at: UtcDateTimeSchema,
    actorId: IdSchema.nullable(),
    actorName: z.string().min(1),
    action: AuditActionSchema,
    targetType: AuditTargetTypeSchema.nullable(),
    targetId: IdSchema.nullable(),
    summary: z.string().min(1),
    ip: z.string().nullable(),
  })
  .refine(
    (data) =>
      (data.targetType === null && data.targetId === null) ||
      (data.targetType !== null && data.targetId !== null),
    {
      message: "targetType and targetId must both be null or both be set",
      path: ["targetType"],
    },
  );
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
