import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import {
  AgentAccountSchema,
  ApprovalRequestSchema,
  ApiErrorSchema,
  UserSchema,
  pageSchema,
} from "@nova/contracts";
import { mockAgentAccount, mockApprovals } from "../data";
import { handlers } from "./index";

const server = setupServer(...handlers);
const base = "http://localhost/api/v1";
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("approval endpoints", () => {
  it("serves the validated static fixtures through the registered handlers", async () => {
    const page = pageSchema(ApprovalRequestSchema).parse(
      await (await fetch(`${base}/approvals`)).json(),
    );
    expect(page).toEqual({ items: mockApprovals, total: mockApprovals.length, nextCursor: null });
    expect(AgentAccountSchema.parse(await (await fetch(`${base}/agent`)).json())).toEqual(
      mockAgentAccount,
    );
  });
  it("paginates and filters approvals", async () => {
    const schema = pageSchema(ApprovalRequestSchema);
    const first = schema.parse(await (await fetch(`${base}/approvals?limit=1`)).json());
    const next = schema.parse(
      await (await fetch(`${base}/approvals?limit=1&cursor=${first.nextCursor}`)).json(),
    );
    expect(first.items).toEqual(mockApprovals.slice(0, 1));
    expect(next.items).toEqual(mockApprovals.slice(1, 2));
    const filtered = schema.parse(await (await fetch(`${base}/approvals?status=pending`)).json());
    expect(filtered.items.map((entry) => entry.status)).toEqual(["pending"]);
    expect(filtered.nextCursor).toBeNull();
    expect(
      schema.parse(await (await fetch(`${base}/approvals?status=expired`)).json()).items,
    ).toEqual([]);
  });
  it.each(["status=invalid", "limit=0", "cursor=invalid"])(
    "rejects invalid query %s",
    async (query) => {
      const response = await fetch(`${base}/approvals?${query}`);
      expect(response.status).toBe(400);
      expect(ApiErrorSchema.parse(await response.json()).error.code).toBe("invalid_request");
    },
  );
  it.each(["approve", "reject"])("answers %s without changing static fixtures", async (action) => {
    const response = await fetch(`${base}/approvals/approval_pending/${action}`, {
      method: "POST",
    });
    expect(response.status).toBe(200);
    const result = ApprovalRequestSchema.parse(await response.json());
    expect(result.status).toBe(action === "approve" ? "done" : "rejected");
    expect(result.decidedBy).toBe("Admin");
    expect(result.resultStatus).toBe(action === "approve" ? 201 : null);
    expect(mockApprovals[0]?.status).toBe("pending");
  });
  it.each(["approve", "reject"])("rejects %s on unknown or decided requests", async (action) => {
    expect((await fetch(`${base}/approvals/missing/${action}`, { method: "POST" })).status).toBe(
      404,
    );
    expect(
      (await fetch(`${base}/approvals/approval_done/${action}`, { method: "POST" })).status,
    ).toBe(400);
  });
});

describe("agent endpoints", () => {
  it.each([
    [
      "POST",
      "/agent",
      { name: "Helper", email: "agent@example.com", password: "x".repeat(12) },
      201,
    ],
    ["PUT", "/agent/password", { password: "x".repeat(12) }, 200],
    ["PATCH", "/agent", { enabled: false }, 200],
  ] as const)(
    "validates %s %s and never returns the password",
    async (method, path, body, status) => {
      const response = await fetch(base + path, { method, body: JSON.stringify(body) });
      expect(response.status).toBe(status);
      const account = AgentAccountSchema.parse(await response.json());
      expect(account).not.toHaveProperty("password");
      if (method === "POST") expect(account.name).toBe("Helper");
      if (method === "PATCH") expect(account.enabled).toBe(false);
    },
  );
  it.each([
    ["POST", "/agent", { name: "Helper", email: "invalid", password: "x".repeat(12) }],
    ["POST", "/agent", { name: "Helper", email: "agent@example.com", password: "short" }],
    ["PUT", "/agent/password", { password: "short" }],
    ["PATCH", "/agent", { enabled: "false" }],
  ] as const)("rejects bad %s %s bodies", async (method, path, body) => {
    expect((await fetch(base + path, { method, body: JSON.stringify(body) })).status).toBe(400);
    expect((await fetch(base + path, { method, body: "invalid json" })).status).toBe(400);
  });
  it("mock login returns the agent role", async () => {
    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email: "agent@example.com", password: "demo" }),
    });
    expect(UserSchema.parse(await response.json()).role).toBe("agent");
  });
});
