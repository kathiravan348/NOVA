import {
  DataJobDeleteResultSchema,
  DataJobSchema,
  DownloadSettingsSchema,
  type DataJob,
  type DataJobDeleteResult,
  type DataJobPlanRequest,
  type DownloadSettings,
  type DownloadSettingsUpdate,
} from "@nova/contracts";
import { apiGet, apiPost, apiRequest, withQuery, type RequestOptions } from "../http";

const id = (value: string) => encodeURIComponent(value);

/** Plans a download as a `draft` job with its steps and cost; nothing runs until Start (D57). */
export function planDataJob(body: DataJobPlanRequest, init?: RequestOptions): Promise<DataJob> {
  return apiPost("/data-jobs/plan", body, DataJobSchema, init);
}

export type JobAction = "start" | "pause" | "resume";

/** Start a draft, pause a waiting or running download, or resume a paused one (D57). */
export function changeDataJob(
  jobId: string,
  action: JobAction,
  init?: RequestOptions,
): Promise<DataJob> {
  return apiPost(`/data-jobs/${id(jobId)}/${action}`, undefined, DataJobSchema, init);
}

/** Deletes a finished job; `candles` also removes a download's candles (NOVA-095). */
export function deleteDataJob(
  jobId: string,
  options: { candles?: boolean } = {},
  init?: RequestOptions,
): Promise<DataJobDeleteResult> {
  const path = withQuery(`/data-jobs/${id(jobId)}`, {
    candles: options.candles ? "true" : undefined,
  });
  return apiRequest("DELETE", path, undefined, DataJobDeleteResultSchema, init);
}

export function getDownloadSettings(init?: RequestOptions): Promise<DownloadSettings> {
  return apiGet("/data-jobs/settings", DownloadSettingsSchema, init);
}

export function updateDownloadSettings(
  body: DownloadSettingsUpdate,
  init?: RequestOptions,
): Promise<DownloadSettings> {
  return apiRequest("PATCH", "/data-jobs/settings", body, DownloadSettingsSchema, init);
}
