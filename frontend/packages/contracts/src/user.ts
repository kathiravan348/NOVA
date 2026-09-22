import { z } from "zod";
import { IdSchema, UtcDateTimeSchema } from "./common";

export const UserRoleSchema = z.literal("super_admin");
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  email: z.email(),
  role: UserRoleSchema,
  createdAt: UtcDateTimeSchema,
  lastLoginAt: UtcDateTimeSchema.nullable(),
});
export type User = z.infer<typeof UserSchema>;
