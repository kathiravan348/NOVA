import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RateLimitEndpoint, RateLimitUpdate } from "@nova/contracts";
import {
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

export function useDataJobs() {
  return useQuery({
    queryKey: queryKeys.dataJobs.all,
    queryFn: ({ signal }) => listDataJobs({ signal }),
  });
}

export function useDataJob(id: string) {
  return useQuery({
    queryKey: queryKeys.dataJobs.detail(id),
    queryFn: ({ signal }) => getDataJob(id, { signal }),
    enabled: Boolean(id),
  });
}

export function useAuditEntries() {
  return useQuery({
    queryKey: queryKeys.auditEntries.all,
    queryFn: ({ signal }) => listAuditEntries({ signal }),
  });
}
