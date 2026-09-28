import { z } from "zod";
import { IdSchema, UtcDateTimeSchema } from "./common";

export const ApprovalStatusSchema = z.enum(["pending", "done", "failed", "rejected", "expired"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export const ApprovalRequestSchema = z.strictObject({
  id: IdSchema,
  method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().startsWith("/"),
  query: z.string(),
  body: z.json(),
  status: ApprovalStatusSchema,
  agentName: z.string().min(1),
  createdAt: UtcDateTimeSchema,
  decidedAt: UtcDateTimeSchema.nullable(),
  decidedBy: z.string().min(1).nullable(),
  resultStatus: z.int().nullable(),
  resultBody: z.string().max(8000).nullable(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export const AgentAccountSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  email: z.email(),
  enabled: z.boolean(),
  createdAt: UtcDateTimeSchema,
  lastLoginAt: UtcDateTimeSchema.nullable(),
});
export type AgentAccount = z.infer<typeof AgentAccountSchema>;
export const AgentAccountCreateSchema = z.strictObject({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(12),
});
export type AgentAccountCreate = z.infer<typeof AgentAccountCreateSchema>;
export const AgentPasswordUpdateSchema = z.strictObject({ password: z.string().min(12) });
export type AgentPasswordUpdate = z.infer<typeof AgentPasswordUpdateSchema>;
export const AgentAccessUpdateSchema = z.strictObject({ enabled: z.boolean() });
export type AgentAccessUpdate = z.infer<typeof AgentAccessUpdateSchema>;
