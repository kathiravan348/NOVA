import { http, HttpResponse } from "msw";
import {
  BrokerAccountCreateSchema,
  DataJobCreateSchema,
  RateLimitUpdateSchema,
  type BrokerAccount,
  type DataJob,
} from "@nova/contracts";
import {
  mockAuditEntries,
  mockBrokerAccounts,
  mockBrokerProfiles,
  mockDataJobs,
  mockInstruments,
  mockRateLimits,
} from "../data";
import { apiPath, badRequest, notFound, paginate } from "./api";

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

  http.get(apiPath("/audit"), ({ request }) => {
    return paginate(mockAuditEntries, request.url);
  }),
];
