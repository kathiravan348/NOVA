import { http, HttpResponse } from "msw";
import {
  DataJobPlanRequestSchema,
  DownloadSettingsUpdateSchema,
  type DataJob,
  type DataJobDeleteResult,
  type DataJobPlan,
  type DownloadSettings,
} from "@nova/contracts";
import { mockDataJobs, mockInstruments } from "../data";
import { apiPath, badRequest, notFound } from "./api";

/** Demo time for everything these handlers answer. */
export const DEMO_NOW = "2026-09-22T04:30:00Z";
const DEMO_EXPIRES = "2026-09-23T04:30:00Z";
/** Demo estimate: rows per request and seconds per request (the real plan computes both, D57). */
const ROWS_PER_REQUEST = 5000;

let mockSettings: DownloadSettings = { marketHoursMode: "slow" };
// The last demo plan, so Start can answer it.
let lastPlan: DataJob | undefined;

/** Puts the demo pace back to Slow down (tests). */
export function resetMockDownloadSettings(): void {
  mockSettings = { marketHoursMode: "slow" };
}

/** Demo coverage: an instrument with candles for the whole period and timeframe counts as stored. */
function storedRange(symbol: string, timeframe: string) {
  const instrument = mockInstruments.find((i) => i.symbol === symbol);
  return instrument?.timeframes.includes(timeframe as never)
    ? { from: instrument.dataFrom, to: instrument.dataTo }
    : null;
}

function findJob(id: string): DataJob | undefined {
  return id === lastPlan?.id ? lastPlan : mockDataJobs.find((j) => j.id === id);
}

const withStatus = (job: DataJob, status: DataJob["status"]): DataJob => ({
  ...job,
  status,
  startedAt: status === "queued" ? null : job.startedAt,
  finishedAt: status === "cancelled" ? DEMO_NOW : job.finishedAt,
  expiresAt: null,
});

export const downloadHandlers = [
  http.get(apiPath("/data-jobs/settings"), () => HttpResponse.json(mockSettings)),

  http.patch(apiPath("/data-jobs/settings"), async ({ request }) => {
    const parsed = DownloadSettingsUpdateSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) return badRequest("Pick Slow down or Full pace");
    mockSettings = parsed.data;
    return HttpResponse.json(mockSettings);
  }),

  // Demo: one step per stock; a stock is "already stored" when its demo candles cover the period.
  http.post(apiPath("/data-jobs/plan"), async ({ request }) => {
    const parsed = DataJobPlanRequestSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid download");
    const body = parsed.data;
    const unknown = body.symbols.filter((s) => !mockInstruments.some((i) => i.symbol === s));
    if (unknown.length > 0) return badRequest(`Not in the stock list: ${unknown.join(", ")}`);
    const perSymbol = body.symbols.map((symbol) => {
      const stored = storedRange(symbol, body.timeframe);
      const covered =
        body.mode === "skip_existing" &&
        stored !== null &&
        stored.from <= body.from &&
        stored.to >= body.to;
      return {
        symbol,
        steps: 1,
        skippedSteps: covered ? 1 : 0,
        existingFrom: stored?.from ?? null,
        existingTo: stored?.to ?? null,
      };
    });
    const skipped = perSymbol.reduce((n, s) => n + s.skippedSteps, 0);
    const requests = body.symbols.length - skipped;
    const plan: DataJobPlan = {
      steps: body.symbols.length,
      skippedSteps: skipped,
      requests,
      estimatedRows: requests * ROWS_PER_REQUEST,
      estimatedBytes: requests * ROWS_PER_REQUEST * 80,
      estimatedSeconds: Math.ceil(requests * 0.6),
      estimatedStartAt: DEMO_NOW,
      jobsAhead: 0,
      perSymbol,
      warnings: [],
    };
    const job: DataJob = {
      id: "job_plan",
      type: "historical_download",
      status: "draft",
      exchange: "NSE",
      segment: body.segment,
      symbols: body.symbols,
      timeframe: body.timeframe,
      from: body.from,
      to: body.to,
      progressPercent: plan.steps ? (skipped * 100) / plan.steps : 100,
      rowsWritten: 0,
      createdAt: DEMO_NOW,
      startedAt: null,
      finishedAt: null,
      error: null,
      summary: null,
      mode: body.mode,
      plan,
      stepsDone: skipped,
      stepsTotal: plan.steps,
      expiresAt: DEMO_EXPIRES,
    };
    lastPlan = job;
    return HttpResponse.json(job, { status: 201 });
  }),

  // Demo: Start/Pause/Resume answer the changed job without storing it.
  http.post(apiPath("/data-jobs/:id/start"), ({ params }) => {
    const id = params["id"] as string;
    const job = findJob(id);
    if (!job) return notFound(`Data job ${id} not found`);
    if (job.status !== "draft")
      return badRequest(`Only a planned job can start; it is ${job.status}`);
    return HttpResponse.json(withStatus(job, "queued"));
  }),

  http.post(apiPath("/data-jobs/:id/pause"), ({ params }) => {
    const id = params["id"] as string;
    const job = findJob(id);
    if (!job) return notFound(`Data job ${id} not found`);
    if (
      job.type !== "historical_download" ||
      (job.status !== "queued" && job.status !== "running")
    ) {
      return badRequest(`Only a waiting or running download can pause; it is ${job.status}`);
    }
    return HttpResponse.json(withStatus(job, "paused"));
  }),

  http.post(apiPath("/data-jobs/:id/resume"), ({ params }) => {
    const id = params["id"] as string;
    const job = findJob(id);
    if (!job) return notFound(`Data job ${id} not found`);
    if (job.status !== "paused")
      return badRequest(`Only a paused job can resume; it is ${job.status}`);
    return HttpResponse.json(withStatus(job, "queued"));
  }),

  // Demo: answers as deleted without removing anything.
  http.delete(apiPath("/data-jobs/:id"), ({ params }) => {
    const id = params["id"] as string;
    const job = findJob(id);
    if (!job) return notFound(`Data job ${id} not found`);
    if (["queued", "running", "paused"].includes(job.status)) {
      return badRequest("Cancel or finish the job first");
    }
    const result: DataJobDeleteResult = { id, candlesDeleted: 0 };
    return HttpResponse.json(result);
  }),
];
