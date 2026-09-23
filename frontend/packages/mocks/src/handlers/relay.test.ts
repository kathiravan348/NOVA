import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import {
  ApiErrorSchema,
  AuditEntrySchema,
  BrokerAccountSchema,
  BrokerProfileSchema,
  DataJobSchema,
  RateLimitSchema,
} from "@nova/contracts";
import {
  mockAuditEntries,
  mockBrokerAccounts,
  mockBrokerProfiles,
  mockDataJobs,
  mockRateLimits,
} from "../data";
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

  it("GET /api/v1/broker/profiles returns the profiles, and one by broker", async () => {
    const list = await fetch("http://localhost/api/v1/broker/profiles");
    expect(BrokerProfileSchema.array().parse(await list.json())).toEqual(mockBrokerProfiles);
    const one = await fetch("http://localhost/api/v1/broker/profiles/zerodha");
    expect(BrokerProfileSchema.parse(await one.json())).toEqual(mockBrokerProfiles[0]);
    const missing = await fetch("http://localhost/api/v1/broker/profiles/upstox");
    expect(missing.status).toBe(404);
  });

  describe("PATCH /api/v1/broker/rate-limits/:accountId/:endpoint", () => {
    const patch = (path: string, body: unknown) =>
      fetch(`http://localhost/api/v1/broker/rate-limits/${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    it("accepts a NOVA limit up to the broker limit with 204", async () => {
      const res = await patch("brk_001/orders", { window: "minute", novaLimit: 400 });
      expect(res.status).toBe(204);
    });

    it("rejects a limit above the broker limit, a bad body or a missing window with 400", async () => {
      for (const body of [
        { window: "second", novaLimit: 2 },
        { window: "second", novaLimit: 0 },
        { window: "second" },
        { window: "day", novaLimit: 1 },
      ]) {
        const res = await patch("brk_001/quote", body);
        expect(res.status).toBe(400);
        expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("invalid_request");
      }
    });

    it("returns 404 for an unknown account or endpoint", async () => {
      expect((await patch("brk_999/orders", { window: "second", novaLimit: 1 })).status).toBe(404);
      expect((await patch("brk_001/margins", { window: "second", novaLimit: 1 })).status).toBe(404);
    });
  });

  it("GET /api/v1/audit returns list of audit entries", async () => {
    const res = await fetch("http://localhost/api/v1/audit");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(AuditEntrySchema.array().parse(data)).toEqual(mockAuditEntries);
  });
});
