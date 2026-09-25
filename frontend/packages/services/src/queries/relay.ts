import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BrokerAccountCreate,
  DataJobCreate,
  RateLimitEndpoint,
  RateLimitUpdate,
} from "@nova/contracts";
import {
  cancelDataJob,
  createBrokerAccount,
  createDataJob,
  getBrokerAccount,
  getBrokerProfile,
  listBrokerProfiles,
  updateRateLimit,
  getDataJob,
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

/** Data jobs, one page at a time; `fetchNextPage` loads more. */
export function useDataJobs() {
  return useInfiniteQuery({
    queryKey: queryKeys.dataJobs.list,
    queryFn: ({ signal, pageParam }) => listDataJobs(cursorQuery(pageParam), { signal }),
    ...pagedListOptions,
    select: flattenPages,
  });
}

export function useDataJob(id: string) {
  return useQuery({
    queryKey: queryKeys.dataJobs.detail(id),
    queryFn: ({ signal }) => getDataJob(id, { signal }),
    enabled: Boolean(id),
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
