import { http, HttpResponse } from "msw";
import { mockAuditEntries, mockBrokerAccounts, mockDataJobs, mockRateLimits } from "../data";
import { apiPath, notFound } from "./api";

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
