import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ArchiveJobCreate,
  BrokerAccountCreate,
  DataJob,
  DataJobCreate,
  KiteAppUpdate,
  KiteKeysUpdate,
  KitePassphrase,
  RateLimitEndpoint,
  RateLimitUpdate,
  RecorderSettingsUpdate,
} from "@nova/contracts";
import {
  cancelDataJob,
  checkKitePassphrase,
  createBrokerAccount,
  finishKiteLogin,
  getKiteApp,
  saveKiteKeys,
  updateKiteApp,
  createArchiveJob,
  createDataJob,
  getBrokerAccount,
  getBrokerProfile,
  listBrokerProfiles,
  updateRateLimit,
  getDataJob,
  getRecorder,
  updateRecorder,
  listAuditEntries,
  listBrokerAccounts,
  listDataJobs,
  listRateLimits,
} from "../api/relay";
import { queryKeys } from "./keys";
import { cursorQuery, flattenPages, pagedListOptions } from "./paging";

export function useBrokerAccounts() {
  return useQuery({
    queryKey: queryKeys.brokerAccounts.all,
    queryFn: ({ signal }) => listBrokerAccounts({ signal }),
  });
}

export function useBrokerAccount(id: string) {
  return useQuery({
    queryKey: queryKeys.brokerAccounts.detail(id),
    queryFn: ({ signal }) => getBrokerAccount(id, { signal }),
    enabled: Boolean(id),
  });
}

/** Adds a broker account; refreshes the account list and rate limits (D52). */
export function useCreateBrokerAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BrokerAccountCreate) => createBrokerAccount(body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.brokerAccounts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.rateLimits.all }),
      ]),
  });
}

export function useRateLimits() {
  return useQuery({
    queryKey: queryKeys.rateLimits.all,
    queryFn: ({ signal }) => listRateLimits({ signal }),
  });
}

export interface RateLimitEdit extends RateLimitUpdate {
  accountId: string;
  endpoint: RateLimitEndpoint;
}

export function useUpdateRateLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, endpoint, ...body }: RateLimitEdit) =>
      updateRateLimit(accountId, endpoint, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rateLimits.all }),
  });
}

export function useKiteApp(accountId: string) {
  return useQuery({
    queryKey: queryKeys.kiteApp(accountId),
    queryFn: ({ signal }) => getKiteApp(accountId, { signal }),
    enabled: Boolean(accountId),
  });
}

/**
 * Mutations whose body holds a secret or passphrase (D55): no cache entry outlives the call.
 * Callers also `reset()` after each attempt so the observer drops the variables.
 */
const SECRET_BODY = { gcTime: 0 } as const;

/** Saving keys may end the account's session (new key): refresh the app and the accounts. */
export function useSaveKiteKeys(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...SECRET_BODY,
    mutationFn: (body: KiteKeysUpdate) => saveKiteKeys(accountId, body),
    onSuccess: (app) => {
      queryClient.setQueryData(queryKeys.kiteApp(accountId), app);
      return queryClient.invalidateQueries({ queryKey: queryKeys.brokerAccounts.all });
    },
  });
}

export function useUpdateKiteApp(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: KiteAppUpdate) => updateKiteApp(accountId, body),
    onSuccess: (app) => queryClient.setQueryData(queryKeys.kiteApp(accountId), app),
  });
}

export function useCheckKitePassphrase(accountId: string) {
  return useMutation({
    ...SECRET_BODY,
    mutationFn: (body: KitePassphrase) => checkKitePassphrase(accountId, body),
  });
}

/** Finishes the daily login with the passphrase; refreshes the accounts and the recorder state. */
export function useFinishKiteLogin(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...SECRET_BODY,
    mutationFn: (body: KitePassphrase) => finishKiteLogin(accountId, body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.brokerAccounts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.recorder }),
      ]),
  });
}

export function useBrokerProfiles() {
  return useQuery({
    queryKey: queryKeys.brokerProfiles.all,
    queryFn: ({ signal }) => listBrokerProfiles({ signal }),
  });
}

export function useBrokerProfile(broker: string) {
  return useQuery({
    queryKey: queryKeys.brokerProfiles.detail(broker),
    queryFn: ({ signal }) => getBrokerProfile(broker, { signal }),
    enabled: Boolean(broker),
  });
}

/** How often job screens refresh while a job is queued or running (D56 (5)). */
export const JOB_POLL_MS = { detail: 3_000, list: 5_000 };

function isActive(job: Pick<DataJob, "status">): boolean {
  return job.status === "queued" || job.status === "running";
}

/** Data jobs, one page at a time; `fetchNextPage` loads more. Refreshes while any job is active. */
export function useDataJobs() {
  return useInfiniteQuery({
    queryKey: queryKeys.dataJobs.list,
    queryFn: ({ signal, pageParam }) => listDataJobs(cursorQuery(pageParam), { signal }),
    ...pagedListOptions,
    select: flattenPages,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) => page.items.some(isActive)) ? JOB_POLL_MS.list : false,
  });
}

/** One job; refreshes while it is queued or running, and refreshes the list when its status changes. */
export function useDataJob(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.dataJobs.detail(id),
    queryFn: async ({ signal }) => {
      const before = queryClient.getQueryData<DataJob>(queryKeys.dataJobs.detail(id));
      const job = await getDataJob(id, { signal });
      if (before && before.status !== job.status) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.dataJobs.list });
      }
      return job;
    },
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data && isActive(query.state.data) ? JOB_POLL_MS.detail : false,
  });
}

/** Queues a historical download; refreshes the data-jobs list (D54). */
export function useCreateDataJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DataJobCreate) => createDataJob(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dataJobs.list }),
  });
}

/** Cancels a queued or running job; refreshes the list and that job. */
export function useCancelDataJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => cancelDataJob(jobId),
    onSuccess: (job) => {
      queryClient.setQueryData(queryKeys.dataJobs.detail(job.id), job);
      return queryClient.invalidateQueries({ queryKey: queryKeys.dataJobs.all });
    },
  });
}

/** Audit entries, one page at a time; `fetchNextPage` loads more. */
export function useAuditEntries() {
  return useInfiniteQuery({
    queryKey: queryKeys.auditEntries.list,
    queryFn: ({ signal, pageParam }) => listAuditEntries(cursorQuery(pageParam), { signal }),
    ...pagedListOptions,
    select: flattenPages,
  });
}

/** Queues an archive of old ticks; refreshes the data-jobs list (D54). */
export function useCreateArchiveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ArchiveJobCreate) => createArchiveJob(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dataJobs.list }),
  });
}

/** The recording switch; refreshed every 30 s, like the recorder itself. */
export function useRecorder() {
  return useQuery({
    queryKey: queryKeys.recorder,
    queryFn: ({ signal }) => getRecorder({ signal }),
    refetchInterval: 30_000,
  });
}

export function useUpdateRecorder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RecorderSettingsUpdate) => updateRecorder(body),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.recorder, settings);
      return queryClient.invalidateQueries({ queryKey: queryKeys.auditEntries.all });
    },
  });
}

/** The newest `instrument_sync` job, or null; refreshes while it is queued or running (D56). */
export function useLatestSync() {
  return useQuery({
    queryKey: queryKeys.dataJobs.latestSync,
    queryFn: async ({ signal }) => {
      const page = await listDataJobs({ limit: 1, type: "instrument_sync" }, { signal });
      return page.items[0] ?? null;
    },
    refetchInterval: (query) =>
      query.state.data && isActive(query.state.data) ? JOB_POLL_MS.detail : false,
  });
}
