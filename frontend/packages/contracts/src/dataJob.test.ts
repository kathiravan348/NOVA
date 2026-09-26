import { describe, expect, it } from "vitest";
import {
  ArchiveJobCreateSchema,
  DataJob,
  DataJobCreateSchema,
  DataJobSchema,
  DataJobStatusSchema,
  DataJobTypeSchema,
  DataJobPlan,
  DataJobPlanRequestSchema,
  DownloadSettingsSchema,
} from "./dataJob";

describe("DataJob schemas", () => {
  const validCompletedHistoricalJob: DataJob = {
    id: "job-001",
    type: "historical_download",
    status: "completed",
    exchange: "NSE",
    segment: "equity_intraday",
    symbols: ["RELIANCE", "TCS"],
    timeframe: "1m",
    from: "2025-01-01",
    to: "2025-01-31",
    progressPercent: 100,
    rowsWritten: 45000,
    createdAt: "2026-01-01T06:00:00Z",
    startedAt: "2026-01-01T06:01:00Z",
    finishedAt: "2026-01-01T06:10:00Z",
    error: null,
    summary: null,
    mode: null,
    plan: null,
    stepsDone: 0,
    stepsTotal: 0,
    expiresAt: null,
  };

  const validRunningTickJob: DataJob = {
    id: "job-002",
    type: "tick_record",
    status: "running",
    exchange: "NFO",
    segment: "futures",
    symbols: ["NIFTY26JANFUT"],
    timeframe: null,
    from: null,
    to: null,
    progressPercent: 45,
    rowsWritten: 12000,
    createdAt: "2026-01-01T09:15:00Z",
    startedAt: "2026-01-01T09:15:05Z",
    finishedAt: null,
    error: null,
    summary: null,
    mode: null,
    plan: null,
    stepsDone: 0,
    stepsTotal: 0,
    expiresAt: null,
  };

  describe("DataJobTypeSchema", () => {
    it("accepts valid data job types", () => {
      expect(DataJobTypeSchema.safeParse("historical_download").success).toBe(true);
      expect(DataJobTypeSchema.safeParse("tick_record").success).toBe(true);
      expect(DataJobTypeSchema.safeParse("archive").success).toBe(true);
    });

    it("rejects invalid data job type enum", () => {
      expect(DataJobTypeSchema.safeParse("stream").success).toBe(false);
    });
  });

  describe("DataJobStatusSchema", () => {
    it("accepts valid statuses", () => {
      expect(DataJobStatusSchema.safeParse("queued").success).toBe(true);
      expect(DataJobStatusSchema.safeParse("running").success).toBe(true);
      expect(DataJobStatusSchema.safeParse("completed").success).toBe(true);
      expect(DataJobStatusSchema.safeParse("failed").success).toBe(true);
      expect(DataJobStatusSchema.safeParse("cancelled").success).toBe(true);
    });

    it("rejects invalid status enum", () => {
      expect(DataJobStatusSchema.safeParse("stopped").success).toBe(false);
    });
  });

  describe("DataJobSchema", () => {
    it("accepts a valid completed historical_download job", () => {
      expect(DataJobSchema.safeParse(validCompletedHistoricalJob).success).toBe(true);
    });

    it("accepts a valid running tick_record job", () => {
      expect(DataJobSchema.safeParse(validRunningTickJob).success).toBe(true);
    });

    it("accepts a valid queued job with null startedAt and finishedAt", () => {
      const queuedJob: DataJob = {
        ...validCompletedHistoricalJob,
        status: "queued",
        progressPercent: 0,
        rowsWritten: 0,
        startedAt: null,
        finishedAt: null,
      };
      expect(DataJobSchema.safeParse(queuedJob).success).toBe(true);
    });

    it("accepts a valid failed job with error message", () => {
      const failedJob: DataJob = {
        ...validCompletedHistoricalJob,
        status: "failed",
        progressPercent: 30,
        finishedAt: "2026-01-01T06:05:00Z",
        error: "Rate limit exceeded during download",
      };
      expect(DataJobSchema.safeParse(failedJob).success).toBe(true);
    });

    it("rejects historical_download when timeframe is null", () => {
      const invalid = { ...validCompletedHistoricalJob, timeframe: null };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects historical_download when from is null", () => {
      const invalid = { ...validCompletedHistoricalJob, from: null };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects historical_download when to is null", () => {
      const invalid = { ...validCompletedHistoricalJob, to: null };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects tick_record when timeframe is set", () => {
      const invalid = { ...validRunningTickJob, timeframe: "1m" };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects when from is set but to is null", () => {
      const invalid = {
        ...validRunningTickJob,
        from: "2025-01-01",
        to: null,
      };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects when from is null but to is set", () => {
      const invalid = {
        ...validRunningTickJob,
        from: null,
        to: "2025-01-31",
      };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects when from is greater than to", () => {
      const invalid = {
        ...validCompletedHistoricalJob,
        from: "2025-02-01",
        to: "2025-01-01",
      };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects error set when status is not failed", () => {
      const invalid = {
        ...validCompletedHistoricalJob,
        status: "completed",
        error: "Unexpected error",
      };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects completed status when progressPercent < 100", () => {
      const invalid = {
        ...validCompletedHistoricalJob,
        progressPercent: 99,
      };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects completed status when finishedAt is null", () => {
      const invalid = {
        ...validCompletedHistoricalJob,
        finishedAt: null,
      };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects queued status when startedAt is set", () => {
      const invalid = {
        ...validCompletedHistoricalJob,
        status: "queued",
        progressPercent: 0,
        startedAt: "2026-01-01T06:01:00Z",
        finishedAt: null,
      };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects queued status when finishedAt is set", () => {
      const invalid = {
        ...validCompletedHistoricalJob,
        status: "queued",
        progressPercent: 0,
        startedAt: null,
        finishedAt: "2026-01-01T06:10:00Z",
      };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects empty symbols array", () => {
      const invalid = {
        ...validCompletedHistoricalJob,
        symbols: [],
      };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects extra fields because of strictObject", () => {
      const invalid = { ...validCompletedHistoricalJob, extra: 123 };
      expect(DataJobSchema.safeParse(invalid).success).toBe(false);
    });
  });
});

describe("DataJobCreateSchema", () => {
  const body = { symbols: ["INFY", "TCS"], timeframe: "1d", from: "2025-01-01", to: "2025-12-31" };

  it("accepts a download and defaults the segment", () => {
    const parsed = DataJobCreateSchema.parse(body);
    expect(parsed.segment).toBe("equity_delivery");
  });

  it.each([
    { symbols: [] },
    { symbols: Array.from({ length: 201 }, (_, i) => `S${i}`) },
    { from: "2026-01-01", to: "2025-01-01" },
    { timeframe: "2d" },
    { extra: true },
  ])("rejects %o", (change) => {
    expect(DataJobCreateSchema.safeParse({ ...body, ...change }).success).toBe(false);
  });
});

describe("ArchiveJobCreateSchema", () => {
  it("takes one date", () => {
    expect(ArchiveJobCreateSchema.parse({ before: "2026-09-01" }).before).toBe("2026-09-01");
    expect(ArchiveJobCreateSchema.safeParse({ before: "1 Sep" }).success).toBe(false);
    expect(ArchiveJobCreateSchema.safeParse({}).success).toBe(false);
  });
});

describe("Planned downloads (D57)", () => {
  const plan: DataJobPlan = {
    steps: 4,
    skippedSteps: 1,
    requests: 3,
    estimatedRows: 1125,
    estimatedBytes: 90000,
    estimatedSeconds: 2,
    estimatedStartAt: "2026-09-26T06:00:00Z",
    jobsAhead: 0,
    perSymbol: [
      {
        symbol: "INFY",
        steps: 4,
        skippedSteps: 1,
        existingFrom: "2025-01-01",
        existingTo: "2025-03-31",
      },
    ],
    warnings: [],
  };
  const draft: DataJob = {
    id: "job-plan",
    type: "historical_download",
    status: "draft",
    exchange: "NSE",
    segment: "equity_delivery",
    symbols: ["INFY"],
    timeframe: "1m",
    from: "2025-01-01",
    to: "2025-12-31",
    progressPercent: 0,
    rowsWritten: 0,
    createdAt: "2026-09-26T06:00:00Z",
    startedAt: null,
    finishedAt: null,
    error: null,
    summary: null,
    mode: "skip_existing",
    plan,
    stepsDone: 0,
    stepsTotal: 4,
    expiresAt: "2026-09-27T06:00:00Z",
  };

  it("accepts a draft with a plan and a paused job", () => {
    expect(DataJobSchema.parse(draft)).toEqual(draft);
    const paused = {
      ...draft,
      status: "paused",
      startedAt: "2026-09-26T06:01:00Z",
      expiresAt: null,
    };
    expect(DataJobSchema.safeParse(paused).success).toBe(true);
  });

  it.each([{ plan: null }, { expiresAt: null }, { startedAt: "2026-09-26T06:01:00Z" }])(
    "rejects a draft with %o",
    (change) => {
      expect(DataJobSchema.safeParse({ ...draft, ...change }).success).toBe(false);
    },
  );

  it("plan request defaults to skipping stored candles", () => {
    const body = { symbols: ["INFY"], timeframe: "1m", from: "2025-01-01", to: "2025-12-31" };
    expect(DataJobPlanRequestSchema.parse(body).mode).toBe("skip_existing");
    expect(DataJobPlanRequestSchema.safeParse({ ...body, mode: "append" }).success).toBe(false);
  });

  it("download settings take slow or full", () => {
    expect(DownloadSettingsSchema.parse({ marketHoursMode: "full" }).marketHoursMode).toBe("full");
    expect(DownloadSettingsSchema.safeParse({ marketHoursMode: "fast" }).success).toBe(false);
  });
});
