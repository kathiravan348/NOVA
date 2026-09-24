import {
  AuditEntrySchema,
  BrokerAccountSchema,
  BrokerProfileSchema,
  DataJobSchema,
  RateLimitSchema,
  pageSchema,
  type AuditEntry,
  type BrokerAccount,
  type BrokerProfile,
  type DataJob,
  type Page,
  type PageQuery,
  type RateLimit,
  type RateLimitEndpoint,
  type RateLimitUpdate,
} from "@nova/contracts";
import { apiGet, apiSend, withQuery, type RequestOptions } from "../http";

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

/** One page of data jobs (D32). */
export function listDataJobs(query: PageQuery = {}, init?: RequestOptions): Promise<Page<DataJob>> {
  return apiGet(withQuery("/data-jobs", { ...query }), pageSchema(DataJobSchema), init);
}

export function getDataJob(jobId: string, init?: RequestOptions): Promise<DataJob> {
  return apiGet(`/data-jobs/${id(jobId)}`, DataJobSchema, init);
}

/** One page of audit entries (D32). */
export function listAuditEntries(
  query: PageQuery = {},
  init?: RequestOptions,
): Promise<Page<AuditEntry>> {
  return apiGet(withQuery("/audit", { ...query }), pageSchema(AuditEntrySchema), init);
}
