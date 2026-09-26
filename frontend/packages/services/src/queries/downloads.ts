import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DataJobPlanRequest, DownloadSettingsUpdate } from "@nova/contracts";
import {
  changeDataJob,
  deleteDataJob,
  getDownloadSettings,
  planDataJob,
  updateDownloadSettings,
  type JobAction,
} from "../api/downloads";
import { applyJobUpdate, removeJobFromCache } from "../realtime";
import { queryKeys } from "./keys";

/** Plans a download as a draft (D57); the draft joins the job caches like any other job. */
export function usePlanDataJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DataJobPlanRequest) => planDataJob(body),
    onSuccess: (job) => applyJobUpdate(queryClient, job),
  });
}

/** Start, Pause or Resume a job; the answer replaces it in the caches. */
export function useChangeDataJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, action }: { jobId: string; action: JobAction }) =>
      changeDataJob(jobId, action),
    onSuccess: (job) => {
      applyJobUpdate(queryClient, job);
      return queryClient.invalidateQueries({ queryKey: queryKeys.auditEntries.all });
    },
  });
}

/** Deletes a finished job (and, with `candles`, its candles); it leaves every cache (NOVA-095). */
export function useDeleteDataJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, candles = false }: { jobId: string; candles?: boolean }) =>
      deleteDataJob(jobId, { candles }),
    onSuccess: (result) => {
      removeJobFromCache(queryClient, result.id);
      return queryClient.invalidateQueries({ queryKey: queryKeys.marketData.instruments });
    },
  });
}

/** Download pace in market hours (D57 (5)). */
export function useDownloadSettings() {
  return useQuery({
    queryKey: queryKeys.downloadSettings,
    queryFn: ({ signal }) => getDownloadSettings({ signal }),
  });
}

export function useUpdateDownloadSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DownloadSettingsUpdate) => updateDownloadSettings(body),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.downloadSettings, settings);
      return queryClient.invalidateQueries({ queryKey: queryKeys.auditEntries.all });
    },
  });
}
