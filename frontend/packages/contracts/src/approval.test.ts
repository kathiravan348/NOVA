import { describe, expect, it } from "vitest";
import {
  AgentAccessUpdateSchema,
  AgentAccountCreateSchema,
  AgentAccountSchema,
  AgentPasswordUpdateSchema,
  ApprovalRequestSchema,
  ApprovalStatusSchema,
} from "./approval";

const approval = {
  id: "approval_1",
  method: "POST",
  path: "/backtests",
  query: "",
  body: null,
  status: "pending",
  agentName: "Agent",
  createdAt: "2026-09-28T04:00:00Z",
  decidedAt: null,
  decidedBy: null,
  resultStatus: null,
  resultBody: null,
};
const account = {
  id: "agent_1",
  name: "Agent",
  email: "agent@example.com",
  enabled: true,
  createdAt: "2026-09-28T04:00:00Z",
  lastLoginAt: null,
};

describe("approval contracts", () => {
  it.each([null, false, 12.5, "text", [1, null], { nested: [true, { a: "b" }] }])(
    "accepts a JSON body %#",
    (body) => {
      expect(ApprovalRequestSchema.parse({ ...approval, body }).body).toEqual(body);
    },
  );
  it.each(ApprovalStatusSchema.options)("accepts status %s", (status) => {
    expect(ApprovalRequestSchema.parse({ ...approval, status }).status).toBe(status);
  });
  it.each([
    { body: undefined },
    { body: { nested: undefined } },
    { body: NaN },
    { path: "backtests" },
    { method: "GET" },
    { status: "approved" },
    { resultStatus: 200.5 },
    { resultBody: "x".repeat(8001) },
    { createdAt: "2026-09-28T09:30:00+05:30" },
    { extra: true },
  ])("rejects an invalid request %#", (change) => {
    expect(ApprovalRequestSchema.safeParse({ ...approval, ...change }).success).toBe(false);
  });
  it("accepts a decided request and the result size boundary", () => {
    expect(
      ApprovalRequestSchema.safeParse({
        ...approval,
        status: "done",
        decidedAt: "2026-09-28T04:01:00Z",
        decidedBy: "Admin",
        resultStatus: 201,
        resultBody: "x".repeat(8000),
      }).success,
    ).toBe(true);
  });
});

describe("agent account contracts", () => {
  it("accepts an account but never a password in a response", () => {
    expect(AgentAccountSchema.parse(account)).toEqual(account);
    expect(AgentAccountSchema.safeParse({ ...account, password: "x" }).success).toBe(false);
    expect(AgentAccountSchema.safeParse({ ...account, enabled: "true" }).success).toBe(false);
  });
  it("validates account creation and password length", () => {
    const body = { name: "Agent", email: "agent@example.com", password: "x".repeat(12) };
    expect(AgentAccountCreateSchema.parse(body)).toEqual(body);
    expect(AgentAccountCreateSchema.safeParse({ ...body, email: "invalid" }).success).toBe(false);
    expect(AgentAccountCreateSchema.safeParse({ ...body, name: "" }).success).toBe(false);
    for (const password of ["", "x".repeat(11)]) {
      expect(AgentAccountCreateSchema.safeParse({ ...body, password }).success).toBe(false);
      expect(AgentPasswordUpdateSchema.safeParse({ password }).success).toBe(false);
    }
    expect(AgentPasswordUpdateSchema.parse({ password: body.password })).toEqual({
      password: body.password,
    });
  });
  it("accepts a boolean access toggle only", () => {
    expect(AgentAccessUpdateSchema.parse({ enabled: false })).toEqual({ enabled: false });
    expect(AgentAccessUpdateSchema.safeParse({ enabled: 0 }).success).toBe(false);
    expect(AgentAccessUpdateSchema.safeParse({ enabled: true, role: "super_admin" }).success).toBe(
      false,
    );
  });
});
