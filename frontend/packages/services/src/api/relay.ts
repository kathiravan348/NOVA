import {
  AuditEntrySchema,
  BrokerAccountSchema,
  BrokerProfileSchema,
  DataJobSchema,
  RateLimitSchema,
  type AuditEntry,
  type BrokerAccount,
  type BrokerProfile,
  type DataJob,
  type RateLimit,
  type RateLimitEndpoint,
  type RateLimitUpdate,
} from "@nova/contracts";
import { apiGet, apiSend, type RequestOptions } from "../http";

const id = (value: string) => encodeURIComponent(value);

export function listBrokerAccounts(init?: RequestOptions): Promise<BrokerAccount[]> {
  return apiGet("/broker/accounts", BrokerAccountSchema.array(), init);
}

export function getBrokerAccount(accountId: string, init?: RequestOptions): Promise<BrokerAccount> {
  return apiGet(`/broker/accounts/${id(accountId)}`, BrokerAccountSchema, init);
}

export function listRateLimits(init?: RequestOptions): Promise<RateLimit[]> {
  return apiGet("/broker/rate-limits", RateLimitSchema.array(), init);
}

/** Changes one NOVA limit; the server rejects values above the broker limit. */
export function updateRateLimit(
  accountId: string,
  endpoint: RateLimitEndpoint,
  body: RateLimitUpdate,
  init?: RequestOptions,
): Promise<void> {
  return apiSend("PATCH", `/broker/rate-limits/${id(accountId)}/${id(endpoint)}`, body, init);
}

export function listBrokerProfiles(init?: RequestOptions): Promise<BrokerProfile[]> {
  return apiGet("/broker/profiles", BrokerProfileSchema.array(), init);
}

export function getBrokerProfile(broker: string, init?: RequestOptions): Promise<BrokerProfile> {
  return apiGet(`/broker/profiles/${id(broker)}`, BrokerProfileSchema, init);
}

export function listDataJobs(init?: RequestOptions): Promise<DataJob[]> {
  return apiGet("/data-jobs", DataJobSchema.array(), init);
}

export function getDataJob(jobId: string, init?: RequestOptions): Promise<DataJob> {
  return apiGet(`/data-jobs/${id(jobId)}`, DataJobSchema, init);
}

export function listAuditEntries(init?: RequestOptions): Promise<AuditEntry[]> {
  return apiGet("/audit", AuditEntrySchema.array(), init);
}
