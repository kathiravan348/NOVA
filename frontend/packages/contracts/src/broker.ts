import { z } from "zod";
import { IdSchema, UtcDateTimeSchema } from "./common";

export const BrokerSchema = z.literal("zerodha");
export type Broker = z.infer<typeof BrokerSchema>;

export const BrokerSessionStatusSchema = z.enum(["active", "expired", "not_logged_in"]);
export type BrokerSessionStatus = z.infer<typeof BrokerSessionStatusSchema>;

export const BrokerSessionSchema = z
  .strictObject({
    status: BrokerSessionStatusSchema,
    loggedInAt: UtcDateTimeSchema.nullable(),
    expiresAt: UtcDateTimeSchema.nullable(),
  })
  .refine(
    (data) =>
      data.status === "not_logged_in"
        ? data.loggedInAt === null && data.expiresAt === null
        : data.loggedInAt !== null && data.expiresAt !== null,
    {
      message:
        "not_logged_in requires null loggedInAt and expiresAt; other statuses require both to be set",
      path: ["status"],
    },
  )
  .refine(
    (data) =>
      data.loggedInAt === null ||
      data.expiresAt === null ||
      new Date(data.loggedInAt).getTime() < new Date(data.expiresAt).getTime(),
    {
      message: "loggedInAt must be earlier than expiresAt",
      path: ["loggedInAt"],
    },
  );
export type BrokerSession = z.infer<typeof BrokerSessionSchema>;

export const BrokerAccountSchema = z.strictObject({
  id: IdSchema,
  broker: BrokerSchema,
  label: z.string().min(1),
  clientId: z.string().min(1),
  enabled: z.boolean(),
  session: BrokerSessionSchema,
  createdAt: UtcDateTimeSchema,
});
export type BrokerAccount = z.infer<typeof BrokerAccountSchema>;
