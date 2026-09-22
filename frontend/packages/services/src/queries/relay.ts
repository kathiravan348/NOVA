import { useQuery } from "@tanstack/react-query";
import {
  getBrokerAccount,
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
