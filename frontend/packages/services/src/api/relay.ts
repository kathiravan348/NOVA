import {
  AuditEntrySchema,
  BrokerAccountSchema,
  type BrokerAccountCreate,
  BrokerProfileSchema,
  DataJobSchema,
  KiteAppSchema,
  type KiteApp,
  type KiteAppUpdate,
  type KiteKeysUpdate,
  type KitePassphrase,
  type DataJobCreate,
  RateLimitSchema,
  RecorderSettingsSchema,
  type ArchiveJobCreate,
  type RecorderSettings,
  type RecorderSettingsUpdate,
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
import { apiGet, apiPost, apiRequest, apiSend, withQuery, type RequestOptions } from "../http";

const id = (value: string) => encodeURIComponent(value);

export function listBrokerAccounts(init?: RequestOptions): Promise<BrokerAccount[]> {
  return apiGet("/broker/accounts", BrokerAccountSchema.array(), init);
}

export function getBrokerAccount(accountId: string, init?: RequestOptions): Promise<BrokerAccount> {
  return apiGet(`/broker/accounts/${id(accountId)}`, BrokerAccountSchema, init);
}

/** Adds a Zerodha account (not logged in yet) with default rate limits (D52). */
export function createBrokerAccount(
  body: BrokerAccountCreate,
  init?: RequestOptions,
): Promise<BrokerAccount> {
  return apiPost("/broker/accounts", body, BrokerAccountSchema, init);
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

/** Page that starts the daily Kite login (a browser navigation, not a fetch; D39). */
export function brokerLoginUrl(accountId: string): string {
  return `/api/v1/broker/accounts/${id(accountId)}/login`;
}

/** The account's own Kite app (D55): key last 4, whether a secret is saved, app details. */
export function getKiteApp(accountId: string, init?: RequestOptions): Promise<KiteApp> {
  return apiGet(`/broker/accounts/${id(accountId)}/kite-app`, KiteAppSchema, init);
}

/** Saves the API key and secret; the server seals the secret with the passphrase and forgets both. */
export function saveKiteKeys(
  accountId: string,
  body: KiteKeysUpdate,
  init?: RequestOptions,
): Promise<KiteApp> {
  return apiRequest(
    "PUT",
    `/broker/accounts/${id(accountId)}/kite-app/keys`,
    body,
    KiteAppSchema,
    init,
  );
}

export function updateKiteApp(
  accountId: string,
  body: KiteAppUpdate,
  init?: RequestOptions,
): Promise<KiteApp> {
  return apiRequest(
    "PATCH",
    `/broker/accounts/${id(accountId)}/kite-app`,
    body,
    KiteAppSchema,
    init,
  );
}

/** 204 when the passphrase opens the saved secret; 400 "Wrong passphrase" otherwise. */
export function checkKitePassphrase(
  accountId: string,
  body: KitePassphrase,
  init?: RequestOptions,
): Promise<void> {
  return apiSend("POST", `/broker/accounts/${id(accountId)}/kite-app/check`, body, init);
}

/** Finishes a Kite login that came back with `?kite=finish` (D55). */
export function finishKiteLogin(
  accountId: string,
  body: KitePassphrase,
  init?: RequestOptions,
): Promise<BrokerAccount> {
  return apiPost(`/broker/accounts/${id(accountId)}/login/finish`, body, BrokerAccountSchema, init);
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

/** Queues a historical download for the Atlas worker (D54). */
export function createDataJob(body: DataJobCreate, init?: RequestOptions): Promise<DataJob> {
  return apiPost("/data-jobs", body, DataJobSchema, init);
}

/** Cancels a queued or running job; a running download stops before its next chunk. */
export function cancelDataJob(jobId: string, init?: RequestOptions): Promise<DataJob> {
  return apiPost(`/data-jobs/${id(jobId)}/cancel`, undefined, DataJobSchema, init);
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

/** Queues moving ticks received before `before` (IST) to Parquet files (D54). */
export function createArchiveJob(body: ArchiveJobCreate, init?: RequestOptions): Promise<DataJob> {
  return apiPost("/data-jobs/archive", body, DataJobSchema, init);
}

/** The live tick recording switch and what the recorder is doing (D54). */
export function getRecorder(init?: RequestOptions): Promise<RecorderSettings> {
  return apiGet("/broker/recorder", RecorderSettingsSchema, init);
}

/** Turns recording on or off and sets its stocks (empty = every stock synced with Kite). */
export function updateRecorder(
  body: RecorderSettingsUpdate,
  init?: RequestOptions,
): Promise<RecorderSettings> {
  return apiRequest("PUT", "/broker/recorder", body, RecorderSettingsSchema, init);
}
