import { http, HttpResponse } from "msw";
import {
  BrokerAccountCreateSchema,
  ArchiveJobCreateSchema,
  DataJobCreateSchema,
  KiteAppUpdateSchema,
  KiteKeysUpdateSchema,
  KitePassphraseSchema,
  RecorderSettingsUpdateSchema,
  RateLimitUpdateSchema,
  type BrokerAccount,
  type DataJob,
  type KiteApp,
  type RecorderSettings,
} from "@nova/contracts";
import {
  mockAuditEntries,
  mockBrokerAccounts,
  mockBrokerProfiles,
  mockDataJobs,
  mockInstruments,
  mockKiteApps,
  mockRateLimits,
} from "../data";
import { apiPath, badRequest, notFound, paginate } from "./api";

const RECORDER_OFF: RecorderSettings = {
  enabled: false,
  symbols: [],
  state: "off",
  jobId: null,
  updatedAt: "2026-09-22T04:30:00Z",
};
let mockRecorder: RecorderSettings = RECORDER_OFF;

/** Puts the demo recording switch back to off (tests). */
export function resetMockRecorder(): void {
  mockRecorder = RECORDER_OFF;
}

/** Demo passphrases (D55): this one is always wrong; `expired` finds no pending login. */
export const MOCK_WRONG_PASSPHRASE = "wrong";
export const MOCK_EXPIRED_PASSPHRASE = "expired";
const NO_KEYS = "Save the Kite API key and secret first";
const DEMO_SAVED_AT = "2026-09-22T04:30:00Z";

function kiteAppOf(accountId: string): KiteApp | undefined {
  return mockKiteApps.find((a) => a.accountId === accountId);
}

async function passphraseOf(request: Request): Promise<string | undefined> {
  const parsed = KitePassphraseSchema.safeParse(await request.json().catch(() => undefined));
  return parsed.success ? parsed.data.passphrase : undefined;
}

export const relayHandlers = [
  http.get(apiPath("/broker/accounts"), () => {
    return HttpResponse.json(mockBrokerAccounts);
  }),

  // Demo: validates like the server and answers 201 without storing the account (D52).
  http.post(apiPath("/broker/accounts"), async ({ request }) => {
    const parsed = BrokerAccountCreateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return badRequest("Body must be { label, clientId } with a 4-12 letter or digit client ID");
    }
    const clientId = parsed.data.clientId.toUpperCase();
    if (mockBrokerAccounts.some((a) => a.clientId.toUpperCase() === clientId)) {
      return badRequest(`Account ${clientId} already exists`);
    }
    const account: BrokerAccount = {
      id: "brk_new",
      broker: "zerodha",
      label: parsed.data.label.trim(),
      clientId,
      enabled: true,
      session: { status: "not_logged_in", loggedInAt: null, expiresAt: null },
      createdAt: "2026-09-22T04:30:00Z",
    };
    return HttpResponse.json(account, { status: 201 });
  }),

  http.get(apiPath("/broker/accounts/:id"), ({ params }) => {
    const id = params["id"] as string;
    const account = mockBrokerAccounts.find((a) => a.id === id);
    if (!account) {
      return notFound(`Broker account ${id} not found`);
    }
    return HttpResponse.json(account);
  }),

  http.get(apiPath("/broker/accounts/:id/kite-app"), ({ params }) => {
    const app = kiteAppOf(params["id"] as string);
    return app
      ? HttpResponse.json(app)
      : notFound(`Broker account ${String(params["id"])} not found`);
  }),

  // Demo: validates like the server and answers without storing anything (D55).
  http.put(apiPath("/broker/accounts/:id/kite-app/keys"), async ({ params, request }) => {
    const app = kiteAppOf(params["id"] as string);
    if (!app) return notFound(`Broker account ${String(params["id"])} not found`);
    const parsed = KiteKeysUpdateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return badRequest("Body must be { apiKey, apiSecret, passphrase (12+ characters) }");
    }
    const saved: KiteApp = {
      ...app,
      apiKeyLast4: parsed.data.apiKey.slice(-4),
      secretSaved: true,
      updatedAt: DEMO_SAVED_AT,
    };
    return HttpResponse.json(saved);
  }),

  http.patch(apiPath("/broker/accounts/:id/kite-app"), async ({ params, request }) => {
    const app = kiteAppOf(params["id"] as string);
    if (!app) return notFound(`Broker account ${String(params["id"])} not found`);
    const parsed = KiteAppUpdateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return badRequest("Body must be { plan, subscriptionRenewsOn, postbackUrl, staticIp }");
    }
    const plan = parsed.data.plan?.trim() ?? null;
    return HttpResponse.json({ ...app, ...parsed.data, plan, updatedAt: DEMO_SAVED_AT });
  }),

  http.post(apiPath("/broker/accounts/:id/kite-app/check"), async ({ params, request }) => {
    const app = kiteAppOf(params["id"] as string);
    if (!app) return notFound(`Broker account ${String(params["id"])} not found`);
    const passphrase = await passphraseOf(request);
    if (passphrase === undefined) return badRequest("Body must be { passphrase }");
    if (!app.secretSaved) return badRequest(NO_KEYS);
    if (passphrase === MOCK_WRONG_PASSPHRASE) return badRequest("Wrong passphrase");
    return new HttpResponse(null, { status: 204 });
  }),

  // Demo: any passphrase but the two above finishes the login with an active session.
  http.post(apiPath("/broker/accounts/:id/login/finish"), async ({ params, request }) => {
    const account = mockBrokerAccounts.find((a) => a.id === params["id"]);
    if (!account) return notFound(`Broker account ${String(params["id"])} not found`);
    const passphrase = await passphraseOf(request);
    if (passphrase === undefined) return badRequest("Body must be { passphrase }");
    if (passphrase === MOCK_EXPIRED_PASSPHRASE) {
      return badRequest("Login expired: log in to Kite again");
    }
    if (passphrase === MOCK_WRONG_PASSPHRASE) return badRequest("Wrong passphrase");
    const connected: BrokerAccount = {
      ...account,
      session: {
        status: "active",
        loggedInAt: "2026-09-22T03:45:00Z",
        expiresAt: "2026-09-23T00:30:00Z",
      },
    };
    return HttpResponse.json(connected);
  }),

  http.get(apiPath("/broker/rate-limits"), () => {
    return HttpResponse.json(mockRateLimits);
  }),

  // Stage A: validates the edit and answers 204 without changing the mock data.
  http.patch(apiPath("/broker/rate-limits/:accountId/:endpoint"), async ({ params, request }) => {
    const accountId = params["accountId"] as string;
    const endpoint = params["endpoint"] as string;
    const limit = mockRateLimits.find((l) => l.accountId === accountId && l.endpoint === endpoint);
    if (!limit) {
      return notFound(`Rate limit ${accountId}/${endpoint} not found`);
    }
    const parsed = RateLimitUpdateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return badRequest("Body must be { window, novaLimit } with a positive whole number");
    }
    const rule = limit.rules.find((r) => r.window === parsed.data.window);
    if (!rule) {
      return badRequest(`No ${parsed.data.window} window for ${endpoint}`);
    }
    if (parsed.data.novaLimit > rule.brokerLimit) {
      return badRequest(`Own limit must be at most the broker limit (${rule.brokerLimit})`);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(apiPath("/broker/profiles"), () => {
    return HttpResponse.json(mockBrokerProfiles);
  }),

  http.get(apiPath("/broker/profiles/:broker"), ({ params }) => {
    const broker = params["broker"] as string;
    const profile = mockBrokerProfiles.find((p) => p.broker === broker);
    if (!profile) {
      return notFound(`Broker profile ${broker} not found`);
    }
    return HttpResponse.json(profile);
  }),

  http.get(apiPath("/data-jobs"), ({ request }) => {
    return paginate(mockDataJobs, request.url);
  }),

  http.get(apiPath("/data-jobs/:id"), ({ params }) => {
    const id = params["id"] as string;
    const job = mockDataJobs.find((j) => j.id === id);
    if (!job) {
      return notFound(`Data job ${id} not found`);
    }
    return HttpResponse.json(job);
  }),

  // Demo: validates like the server and answers 201 without storing the job (D54).
  http.post(apiPath("/data-jobs"), async ({ request }) => {
    const parsed = DataJobCreateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid download");
    }
    const symbols = parsed.data.symbols.map((s) => s.trim().toUpperCase());
    const unknown = symbols.filter((s) => !mockInstruments.some((i) => i.symbol === s));
    if (unknown.length > 0) {
      return badRequest(`Not in the stock list: ${unknown.join(", ")}`);
    }
    const job: DataJob = {
      id: "job_new",
      type: "historical_download",
      status: "queued",
      exchange: "NSE",
      segment: parsed.data.segment,
      symbols,
      timeframe: parsed.data.timeframe,
      from: parsed.data.from,
      to: parsed.data.to,
      progressPercent: 0,
      rowsWritten: 0,
      createdAt: "2026-09-22T04:30:00Z",
      startedAt: null,
      finishedAt: null,
      error: null,
      summary: null,
    };
    return HttpResponse.json(job, { status: 201 });
  }),

  // Demo: answers the job as cancelled without changing the mock data.
  http.post(apiPath("/data-jobs/:id/cancel"), ({ params }) => {
    const id = params["id"] as string;
    const job = mockDataJobs.find((j) => j.id === id);
    if (!job) {
      return notFound(`Data job ${id} not found`);
    }
    if (job.status !== "queued" && job.status !== "running") {
      return badRequest(`Job is already ${job.status}`);
    }
    const finishedAt = job.status === "queued" ? "2026-09-22T04:30:00Z" : null;
    return HttpResponse.json({ ...job, status: "cancelled", finishedAt } satisfies DataJob);
  }),

  // Demo: queues nothing; validates like the server (a future date is refused).
  http.post(apiPath("/data-jobs/archive"), async ({ request }) => {
    const parsed = ArchiveJobCreateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) {
      return badRequest("Body must be { before } with a date");
    }
    if (parsed.data.before > new Date().toISOString().slice(0, 10)) {
      return badRequest("The date must be today or earlier");
    }
    const job: DataJob = {
      id: "job_archive",
      type: "archive",
      status: "queued",
      exchange: "NSE",
      segment: "equity_delivery",
      symbols: ["INFY", "TCS"],
      timeframe: null,
      from: "2026-06-01",
      to: parsed.data.before,
      progressPercent: 0,
      rowsWritten: 0,
      createdAt: "2026-09-22T04:30:00Z",
      startedAt: null,
      finishedAt: null,
      error: null,
      summary: null,
    };
    return HttpResponse.json(job, { status: 201 });
  }),

  http.get(apiPath("/broker/recorder"), () => {
    return HttpResponse.json(mockRecorder);
  }),

  // Demo: remembered until the page reloads, so the switch can be tried out.
  http.put(apiPath("/broker/recorder"), async ({ request }) => {
    const parsed = RecorderSettingsUpdateSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) {
      return badRequest("Body must be { enabled, symbols }");
    }
    const symbols = [...new Set(parsed.data.symbols)].sort();
    const unknown = symbols.filter((s) => !mockInstruments.some((i) => i.symbol === s));
    if (parsed.data.enabled && unknown.length > 0) {
      return badRequest(`Not synced with Kite yet: ${unknown.join(", ")}`);
    }
    mockRecorder = {
      enabled: parsed.data.enabled,
      symbols,
      state: parsed.data.enabled ? "waiting" : "off",
      jobId: null,
      updatedAt: "2026-09-22T04:30:00Z",
    };
    return HttpResponse.json(mockRecorder);
  }),

  http.get(apiPath("/audit"), ({ request }) => {
    return paginate(mockAuditEntries, request.url);
  }),
];
