import { z } from "zod";
import { IdSchema, IsoDateSchema, UtcDateTimeSchema } from "./common";

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

export const BrokerLinkKindSchema = z.enum([
  "docs",
  "rate_limits",
  "console",
  "forum",
  "charges",
  "client_library",
  "other",
]);
export type BrokerLinkKind = z.infer<typeof BrokerLinkKindSchema>;

export const BrokerLinkSchema = z.strictObject({
  label: z.string().min(1),
  url: z.url({ protocol: /^https$/ }),
  kind: BrokerLinkKindSchema,
});
export type BrokerLink = z.infer<typeof BrokerLinkSchema>;

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Broker API and plan facts shown in Relay (D28). Only the last 4 characters of the API key. */
export const BrokerProfileSchema = z.strictObject({
  broker: BrokerSchema,
  name: z.string().min(1),
  api: z.string().min(1),
  plan: z.string().min(1),
  subscriptionRenewsOn: IsoDateSchema.nullable(),
  apiKeyLast4: z.string().regex(/^[A-Za-z0-9]{4}$/),
  redirectUrl: z.url(),
  postbackUrl: z.url().nullable(),
  staticIp: z.string().regex(IPV4).nullable(),
  sessionRule: z.string().min(1),
  links: z.array(BrokerLinkSchema),
});
export type BrokerProfile = z.infer<typeof BrokerProfileSchema>;
