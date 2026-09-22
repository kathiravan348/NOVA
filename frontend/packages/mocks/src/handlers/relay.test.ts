import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import {
  ApiErrorSchema,
  AuditEntrySchema,
  BrokerAccountSchema,
  DataJobSchema,
  RateLimitSchema,
} from "@nova/contracts";
import { mockAuditEntries, mockBrokerAccounts, mockDataJobs, mockRateLimits } from "../data";
import { relayHandlers } from "./relay";

const server = setupServer(...relayHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("Relay MSW handlers", () => {
  it("GET /api/v1/broker/accounts returns list of broker accounts", async () => {
    const res = await fetch("http://localhost/api/v1/broker/accounts");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(BrokerAccountSchema.array().parse(data)).toEqual(mockBrokerAccounts);
  });

  it("GET /api/v1/broker/accounts/:id returns single broker account for valid id", async () => {
    const target = mockBrokerAccounts[0]!;
    const res = await fetch(`http://localhost/api/v1/broker/accounts/${target.id}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(BrokerAccountSchema.parse(data)).toEqual(target);
  });

  it("GET /api/v1/broker/accounts/:id returns 404 ApiError for unknown id", async () => {
    const res = await fetch("http://localhost/api/v1/broker/accounts/unknown_acc");
    expect(res.status).toBe(404);
    const data = await res.json();
    const parsed = ApiErrorSchema.parse(data);
    expect(parsed.error.code).toBe("not_found");
    expect(parsed.error.message).toContain("unknown_acc");
  });

  it("GET /api/v1/broker/rate-limits returns list of rate limits", async () => {
    const res = await fetch("http://localhost/api/v1/broker/rate-limits");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(RateLimitSchema.array().parse(data)).toEqual(mockRateLimits);
  });

  it("GET /api/v1/data-jobs returns list of data jobs", async () => {
    const res = await fetch("http://localhost/api/v1/data-jobs");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(DataJobSchema.array().parse(data)).toEqual(mockDataJobs);
  });

  it("GET /api/v1/data-jobs/:id returns single data job for valid id", async () => {
    const target = mockDataJobs[0]!;
    const res = await fetch(`http://localhost/api/v1/data-jobs/${target.id}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(DataJobSchema.parse(data)).toEqual(target);
  });

  it("GET /api/v1/data-jobs/:id returns 404 ApiError for unknown id", async () => {
    const res = await fetch("http://localhost/api/v1/data-jobs/unknown_job");
    expect(res.status).toBe(404);
    const data = await res.json();
    const parsed = ApiErrorSchema.parse(data);
    expect(parsed.error.code).toBe("not_found");
    expect(parsed.error.message).toContain("unknown_job");
  });

  it("GET /api/v1/audit returns list of audit entries", async () => {
    const res = await fetch("http://localhost/api/v1/audit");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(AuditEntrySchema.array().parse(data)).toEqual(mockAuditEntries);
  });
});
