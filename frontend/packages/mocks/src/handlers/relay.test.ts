import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import {
  ApiErrorSchema,
  AuditEntrySchema,
  BrokerAccountSchema,
  BrokerProfileSchema,
  DataJobSchema,
  KiteAppSchema,
  RateLimitSchema,
  RecorderSettingsSchema,
  pageSchema,
} from "@nova/contracts";
import {
  mockAuditEntries,
  mockBrokerAccounts,
  mockBrokerProfiles,
  mockDataJobs,
  mockRateLimits,
} from "../data";
import { relayHandlers, resetMockRecorder } from "./relay";

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
    expect(pageSchema(DataJobSchema).parse(data)).toEqual({
      items: mockDataJobs,
      nextCursor: null,
    });
  });

  it("GET /api/v1/data-jobs?limit=2 returns the first page and a cursor to the rest", async () => {
    const first = pageSchema(DataJobSchema).parse(
      await (await fetch("http://localhost/api/v1/data-jobs?limit=2")).json(),
    );
    expect(first.items).toEqual(mockDataJobs.slice(0, 2));
    expect(first.nextCursor).not.toBeNull();
    const rest = pageSchema(DataJobSchema).parse(
      await (
        await fetch(`http://localhost/api/v1/data-jobs?limit=200&cursor=${first.nextCursor!}`)
      ).json(),
    );
    expect(rest).toEqual({ items: mockDataJobs.slice(2), nextCursor: null });
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

  describe("POST /api/v1/broker/accounts", () => {
    const post = (body: unknown) =>
      fetch("http://localhost/api/v1/broker/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    it("answers 201 with a not-logged-in account", async () => {
      const res = await post({ label: " Family ", clientId: "zz9999" });
      expect(res.status).toBe(201);
      const account = BrokerAccountSchema.parse(await res.json());
      expect(account).toMatchObject({ label: "Family", clientId: "ZZ9999" });
      expect(account.session.status).toBe("not_logged_in");
    });

    it("rejects a duplicate client ID or a bad body with 400", async () => {
      const duplicate = await post({ label: "Again", clientId: "ab1234" });
      expect(duplicate.status).toBe(400);
      expect(ApiErrorSchema.parse(await duplicate.json()).error.message).toBe(
        "Account AB1234 already exists",
      );
      expect((await post({ label: "Main", clientId: "AB-1" })).status).toBe(400);
    });
  });

  describe("Kite app and login finish (D55)", () => {
    const base = "http://localhost/api/v1/broker/accounts";
    const send = (method: string, path: string, body: unknown) =>
      fetch(`${base}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const message = async (res: Response) => ApiErrorSchema.parse(await res.json()).error.message;
    const keys = {
      apiKey: "newkeyZX90",
      apiSecret: "s3cret",
      passphrase: "long enough passphrase",
    };

    it("GET returns the account's app and 404 for an unknown account", async () => {
      const app = KiteAppSchema.parse(await (await fetch(`${base}/brk_001/kite-app`)).json());
      expect(app).toMatchObject({ accountId: "brk_001", apiKeyLast4: "k7Q2", secretSaved: true });
      expect((await fetch(`${base}/nope/kite-app`)).status).toBe(404);
    });

    it("PUT keys answers the app with the new last 4 and never the secret", async () => {
      const res = await send("PUT", "/brk_003/kite-app/keys", keys);
      const text = await res.text();
      expect(KiteAppSchema.parse(JSON.parse(text))).toMatchObject({
        apiKeyLast4: "ZX90",
        secretSaved: true,
      });
      expect(text).not.toContain("s3cret");
      const short = await send("PUT", "/brk_003/kite-app/keys", { ...keys, passphrase: "short" });
      expect(short.status).toBe(400);
    });

    it("PATCH saves the details and rejects a bad IP", async () => {
      const details = {
        plan: " Paid ",
        subscriptionRenewsOn: null,
        postbackUrl: null,
        staticIp: null,
      };
      const app = KiteAppSchema.parse(
        await (await send("PATCH", "/brk_001/kite-app", details)).json(),
      );
      expect(app.plan).toBe("Paid");
      const bad = await send("PATCH", "/brk_001/kite-app", { ...details, staticIp: "1.2.3" });
      expect(bad.status).toBe(400);
    });

    it("checks the passphrase, and needs saved keys", async () => {
      expect((await send("POST", "/brk_001/kite-app/check", { passphrase: "any" })).status).toBe(
        204,
      );
      const wrong = await send("POST", "/brk_001/kite-app/check", { passphrase: "wrong" });
      expect(await message(wrong)).toBe("Wrong passphrase");
      const noKeys = await send("POST", "/brk_003/kite-app/check", { passphrase: "any" });
      expect(await message(noKeys)).toBe("Save the Kite API key and secret first");
    });

    it("finishes a login, or says wrong / expired", async () => {
      const ok = await send("POST", "/brk_002/login/finish", { passphrase: "any" });
      expect(BrokerAccountSchema.parse(await ok.json()).session.status).toBe("active");
      const wrong = await send("POST", "/brk_002/login/finish", { passphrase: "wrong" });
      expect(await message(wrong)).toBe("Wrong passphrase");
      const expired = await send("POST", "/brk_002/login/finish", { passphrase: "expired" });
      expect(await message(expired)).toBe("Login expired: log in to Kite again");
    });
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
    expect(pageSchema(AuditEntrySchema).parse(data)).toEqual({
      items: mockAuditEntries,
      nextCursor: null,
    });
  });

  it("GET /api/v1/audit?limit=500 answers 400 invalid_request", async () => {
    const res = await fetch("http://localhost/api/v1/audit?limit=500");
    expect(res.status).toBe(400);
  });

  describe("POST /api/v1/data-jobs", () => {
    const post = (body: unknown) =>
      fetch("http://localhost/api/v1/data-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const body = { symbols: ["infy"], timeframe: "1d", from: "2025-01-01", to: "2025-12-31" };

    it("answers 201 with a queued download", async () => {
      const res = await post(body);
      expect(res.status).toBe(201);
      const job = DataJobSchema.parse(await res.json());
      expect(job).toMatchObject({
        status: "queued",
        symbols: ["INFY"],
        segment: "equity_delivery",
      });
    });

    it("rejects an unknown stock or a bad period with 400", async () => {
      const unknown = await post({ ...body, symbols: ["NOPE"] });
      expect(ApiErrorSchema.parse(await unknown.json()).error.message).toBe(
        "Not in the stock list: NOPE",
      );
      expect((await post({ ...body, from: "2026-01-01" })).status).toBe(400);
    });
  });

  describe("POST /api/v1/data-jobs/:id/cancel", () => {
    const cancel = (id: string) =>
      fetch(`http://localhost/api/v1/data-jobs/${id}/cancel`, { method: "POST" });

    it("answers a queued or running job as cancelled", async () => {
      const queued = DataJobSchema.parse(await (await cancel("job_003")).json());
      expect(queued.status).toBe("cancelled");
      expect(queued.finishedAt).not.toBeNull();
      const running = DataJobSchema.parse(await (await cancel("job_002")).json());
      expect(running).toMatchObject({ status: "cancelled", finishedAt: null });
    });

    it("refuses a finished job with 400 and an unknown one with 404", async () => {
      const done = await cancel("job_001");
      expect(done.status).toBe(400);
      expect(ApiErrorSchema.parse(await done.json()).error.message).toBe(
        "Job is already completed",
      );
      expect((await cancel("job_nope")).status).toBe(404);
    });
  });

  describe("POST /api/v1/data-jobs/archive", () => {
    const post = (body: unknown) =>
      fetch("http://localhost/api/v1/data-jobs/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    it("answers a queued archive job, and 400 for a future date", async () => {
      const job = DataJobSchema.parse(await (await post({ before: "2026-09-01" })).json());
      expect(job).toMatchObject({ type: "archive", status: "queued", timeframe: null });
      expect((await post({ before: "2999-01-01" })).status).toBe(400);
    });
  });

  describe("/api/v1/broker/recorder", () => {
    const put = (body: unknown) =>
      fetch("http://localhost/api/v1/broker/recorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const get = async () =>
      RecorderSettingsSchema.parse(
        await (await fetch("http://localhost/api/v1/broker/recorder")).json(),
      );

    it("starts off, remembers a switch-on and can be reset", async () => {
      resetMockRecorder();
      expect((await get()).state).toBe("off");
      const on = RecorderSettingsSchema.parse(
        await (await put({ enabled: true, symbols: ["TCS", "INFY"] })).json(),
      );
      expect(on).toMatchObject({ enabled: true, state: "waiting", symbols: ["INFY", "TCS"] });
      expect((await get()).enabled).toBe(true);
      resetMockRecorder();
      expect((await get()).enabled).toBe(false);
    });

    it("refuses stocks it does not know", async () => {
      const res = await put({ enabled: true, symbols: ["NOPE"] });
      expect(ApiErrorSchema.parse(await res.json()).error.message).toBe(
        "Not synced with Kite yet: NOPE",
      );
    });
  });
});
