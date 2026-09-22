import {
  AuditEntrySchema,
  BrokerAccountSchema,
  DataJobSchema,
  RateLimitSchema,
  type AuditEntry,
  type BrokerAccount,
  type DataJob,
  type RateLimit,
} from "@nova/contracts";
import { apiGet, type RequestOptions } from "../http";

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

export function listDataJobs(init?: RequestOptions): Promise<DataJob[]> {
  return apiGet("/data-jobs", DataJobSchema.array(), init);
}

export function getDataJob(jobId: string, init?: RequestOptions): Promise<DataJob> {
  return apiGet(`/data-jobs/${id(jobId)}`, DataJobSchema, init);
}

export function listAuditEntries(init?: RequestOptions): Promise<AuditEntry[]> {
  return apiGet("/audit", AuditEntrySchema.array(), init);
}
