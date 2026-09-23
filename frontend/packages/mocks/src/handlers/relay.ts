import { http, HttpResponse } from "msw";
import { RateLimitUpdateSchema } from "@nova/contracts";
import {
  mockAuditEntries,
  mockBrokerAccounts,
  mockBrokerProfiles,
  mockDataJobs,
  mockRateLimits,
} from "../data";
import { apiPath, badRequest, notFound } from "./api";

export const relayHandlers = [
  http.get(apiPath("/broker/accounts"), () => {
    return HttpResponse.json(mockBrokerAccounts);
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

  http.get(apiPath("/data-jobs"), () => {
    return HttpResponse.json(mockDataJobs);
  }),

  http.get(apiPath("/data-jobs/:id"), ({ params }) => {
    const id = params["id"] as string;
    const job = mockDataJobs.find((j) => j.id === id);
    if (!job) {
      return notFound(`Data job ${id} not found`);
    }
    return HttpResponse.json(job);
  }),

  http.get(apiPath("/audit"), () => {
    return HttpResponse.json(mockAuditEntries);
  }),
];
