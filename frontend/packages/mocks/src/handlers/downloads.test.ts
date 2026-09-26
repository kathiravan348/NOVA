import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import {
  ApiErrorSchema,
  DataJobDeleteResultSchema,
  DataJobSchema,
  DownloadSettingsSchema,
} from "@nova/contracts";
import { downloadHandlers, resetMockDownloadSettings } from "./downloads";

const server = setupServer(...downloadHandlers);
const base = "http://localhost/api/v1/data-jobs";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetMockDownloadSettings();
});
afterAll(() => server.close());

const post = (path: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const body = { symbols: ["INFY", "SBIN"], timeframe: "1d", from: "2026-07-01", to: "2026-09-18" };

describe("download handlers", () => {
  it("plans a draft; stored stocks are skipped unless overwriting", async () => {
    const skip = DataJobSchema.parse(await (await post("/plan", body)).json());
    const all = DataJobSchema.parse(
      await (await post("/plan", { ...body, mode: "overwrite" })).json(),
    );

    expect(skip.status).toBe("draft");
    expect(skip.plan).toMatchObject({ steps: 2, skippedSteps: 2, requests: 0 });
    expect(all.plan).toMatchObject({ steps: 2, skippedSteps: 0, requests: 2 });
    const bad = await post("/plan", { ...body, symbols: ["NOPE"] });
    expect(bad.status).toBe(400);
    expect(ApiErrorSchema.parse(await bad.json()).error.message).toContain("NOPE");
  });

  it("starts the last plan, pauses, resumes and refuses the wrong state", async () => {
    await post("/plan", body);
    const started = DataJobSchema.parse(await (await post("/job_plan/start")).json());
    expect(started.status).toBe("queued");
    expect((await post("/job_004/pause")).status).toBe(400); // failed download
    expect((await post("/job_004/resume")).status).toBe(400);
    expect((await post("/job_missing/start")).status).toBe(404);
  });

  it("reads and saves the pace, and answers deletes", async () => {
    const read = await fetch(`${base}/settings`);
    expect(DownloadSettingsSchema.parse(await read.json())).toEqual({ marketHoursMode: "slow" });
    const saved = await fetch(`${base}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketHoursMode: "full" }),
    });
    expect(DownloadSettingsSchema.parse(await saved.json())).toEqual({ marketHoursMode: "full" });

    const deleted = await fetch(`${base}/job_001?candles=true`, { method: "DELETE" });
    expect(DataJobDeleteResultSchema.parse(await deleted.json())).toEqual({
      id: "job_001",
      candlesDeleted: 0,
    });
    expect((await fetch(`${base}/job_003`, { method: "DELETE" })).status).toBe(400); // queued
  });
});
