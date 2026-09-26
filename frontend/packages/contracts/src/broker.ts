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

/** Request body for `POST /broker/accounts` (D52): the server trims the label and upper-cases the client ID. */
export const BrokerAccountCreateSchema = z.strictObject({
  label: z.string().max(60).regex(/\S/, "Enter an account name"),
  clientId: z.string().regex(/^[A-Za-z0-9]{4,12}$/, "4–12 letters or digits"),
});
export type BrokerAccountCreate = z.infer<typeof BrokerAccountCreateSchema>;

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

/** Broker facts shown in Relay (D28). App details are per account: `KiteApp` (D55). */
export const BrokerProfileSchema = z.strictObject({
  broker: BrokerSchema,
  name: z.string().min(1),
  api: z.string().min(1),
  sessionRule: z.string().min(1),
  links: z.array(BrokerLinkSchema),
});
export type BrokerProfile = z.infer<typeof BrokerProfileSchema>;

const PlanSchema = z.string().max(60, "At most 60 characters").regex(/\S/, "Enter the plan");
const StaticIpSchema = z.string().regex(IPV4, "An IPv4 address, e.g. 203.0.113.5");

/** One account's Kite Connect app (D55). The secret is never sent, only whether one is saved. */
export const KiteAppSchema = z
  .strictObject({
    accountId: IdSchema,
    apiKeyLast4: z
      .string()
      .regex(/^[A-Za-z0-9]{4}$/)
      .nullable(),
    secretSaved: z.boolean(),
    plan: PlanSchema.nullable(),
    subscriptionRenewsOn: IsoDateSchema.nullable(),
    redirectUrl: z.url(),
    postbackUrl: z.url().nullable(),
    staticIp: StaticIpSchema.nullable(),
    updatedAt: UtcDateTimeSchema.nullable(),
  })
  .refine((app) => (app.apiKeyLast4 !== null) === app.secretSaved, {
    message: "apiKeyLast4 and secretSaved go together",
    path: ["secretSaved"],
  });
export type KiteApp = z.infer<typeof KiteAppSchema>;

/** Body of `PATCH /broker/accounts/{id}/kite-app`: the app details, never the keys. */
export const KiteAppUpdateSchema = z.strictObject({
  plan: PlanSchema.nullable(),
  subscriptionRenewsOn: IsoDateSchema.nullable(),
  postbackUrl: z.url("A full URL, e.g. https://example.com/postback").nullable(),
  staticIp: StaticIpSchema.nullable(),
});
export type KiteAppUpdate = z.infer<typeof KiteAppUpdateSchema>;

/** Shortest passphrase that seals the API secret (D55). */
export const MIN_PASSPHRASE_LENGTH = 12;

/** Body of `PUT /broker/accounts/{id}/kite-app/keys`: the server seals the secret with the passphrase. */
export const KiteKeysUpdateSchema = z.strictObject({
  apiKey: z.string().regex(/^[A-Za-z0-9]{6,64}$/, "6–64 letters or digits"),
  apiSecret: z.string().min(1, "Enter the API secret").max(128).regex(/^\S+$/, "No spaces"),
  passphrase: z
    .string()
    .min(MIN_PASSPHRASE_LENGTH, `At least ${MIN_PASSPHRASE_LENGTH} characters`)
    .max(128),
});
export type KiteKeysUpdate = z.infer<typeof KiteKeysUpdateSchema>;

/** Body of the passphrase check and of finishing a Kite login (D55). */
export const KitePassphraseSchema = z.strictObject({
  passphrase: z.string().min(1, "Enter your passphrase").max(128),
});
export type KitePassphrase = z.infer<typeof KitePassphraseSchema>;
