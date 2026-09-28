import { http, HttpResponse } from "msw";
import {
  AgentAccountCreateSchema,
  AgentPasswordUpdateSchema,
  AgentAccessUpdateSchema,
  ApprovalStatusSchema,
  type ApprovalRequest,
} from "@nova/contracts";
import { mockAgentAccount, mockApprovals, MOCK_NOW } from "../data";
import { apiPath, badRequest, notFound, paginate } from "./api";

// Like the other demo writes, decisions return a result without changing the static fixtures.
function decide(id: string, approved: boolean): Response {
  const request = mockApprovals.find((entry) => entry.id === id);
  if (!request) return notFound("Approval request not found");
  if (request.status !== "pending") return badRequest("Request is no longer pending");
  const result: ApprovalRequest = {
    ...request,
    status: approved ? "done" : "rejected",
    decidedAt: MOCK_NOW,
    decidedBy: "Admin",
    resultStatus: approved ? 201 : null,
    resultBody: approved ? "{}" : null,
  };
  return HttpResponse.json(result);
}

export const approvalHandlers = [
  http.get(apiPath("/approvals"), ({ request }) => {
    const status = new URL(request.url).searchParams.get("status");
    if (status && !ApprovalStatusSchema.safeParse(status).success)
      return badRequest("Invalid approval status");
    return paginate(
      status ? mockApprovals.filter((item) => item.status === status) : mockApprovals,
      request.url,
    );
  }),
  http.post(apiPath("/approvals/:id/approve"), ({ params }) => decide(String(params["id"]), true)),
  http.post(apiPath("/approvals/:id/reject"), ({ params }) => decide(String(params["id"]), false)),
  http.get(apiPath("/agent"), () => HttpResponse.json(mockAgentAccount)),
  http.post(apiPath("/agent"), async ({ request }) => {
    const parsed = AgentAccountCreateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success)
      return badRequest("Enter a name, email and password of at least 12 characters");
    return HttpResponse.json(
      { ...mockAgentAccount, name: parsed.data.name, email: parsed.data.email },
      { status: 201 },
    );
  }),
  http.put(apiPath("/agent/password"), async ({ request }) => {
    const parsed = AgentPasswordUpdateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return badRequest("Password must contain at least 12 characters");
    return HttpResponse.json(mockAgentAccount);
  }),
  http.patch(apiPath("/agent"), async ({ request }) => {
    const parsed = AgentAccessUpdateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return badRequest("Agent access must be true or false");
    return HttpResponse.json({ ...mockAgentAccount, enabled: parsed.data.enabled });
  }),
];
