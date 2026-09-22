import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { ApiErrorSchema } from "@nova/contracts";
import { handlers } from "./index";
import { emptyHandlers, errorHandlers } from "./scenarios";

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("Scenario MSW handlers", () => {
  describe("emptyHandlers scenario", () => {
    it("returns empty arrays for all list endpoints when overridden with emptyHandlers", async () => {
      server.use(...emptyHandlers);

      const listEndpoints = [
        "http://localhost/api/v1/strategies",
        "http://localhost/api/v1/backtests",
        "http://localhost/api/v1/backtests/run_001/trades",
        "http://localhost/api/v1/broker/accounts",
        "http://localhost/api/v1/broker/rate-limits",
        "http://localhost/api/v1/data-jobs",
        "http://localhost/api/v1/audit",
      ];

      for (const endpoint of listEndpoints) {
        const res = await fetch(endpoint);
        expect(res.status, `status 200 for ${endpoint}`).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data), `is array for ${endpoint}`).toBe(true);
        expect(data, `is empty array for ${endpoint}`).toEqual([]);
      }
    });
  });

  describe("errorHandlers scenario", () => {
    it("returns 500 ApiError with internal code for all endpoints when overridden with errorHandlers", async () => {
      server.use(...errorHandlers);

      const allEndpoints = [
        "http://localhost/api/v1/me",
        "http://localhost/api/v1/strategies",
        "http://localhost/api/v1/strategies/stg_001",
        "http://localhost/api/v1/backtests",
        "http://localhost/api/v1/backtests/run_001",
        "http://localhost/api/v1/backtests/run_001/result",
        "http://localhost/api/v1/backtests/run_001/trades",
        "http://localhost/api/v1/broker/accounts",
        "http://localhost/api/v1/broker/accounts/acc_001",
        "http://localhost/api/v1/broker/rate-limits",
        "http://localhost/api/v1/data-jobs",
        "http://localhost/api/v1/data-jobs/job_001",
        "http://localhost/api/v1/audit",
      ];

      for (const endpoint of allEndpoints) {
        const res = await fetch(endpoint);
        expect(res.status, `status 500 for ${endpoint}`).toBe(500);
        const data = await res.json();
        const parsed = ApiErrorSchema.safeParse(data);
        expect(parsed.success, `body matches ApiErrorSchema for ${endpoint}`).toBe(true);
        if (parsed.success) {
          expect(parsed.data.error.code).toBe("internal");
        }
      }
    });
  });
});
