import type { ApprovalRequest } from "@nova/contracts";
import { getNow } from "@nova/services";

export function requestName(request: ApprovalRequest): string {
  const body = request.body;
  const name = body && typeof body === "object" && !Array.isArray(body) ? body["name"] : undefined;
  return typeof name === "string" && name.trim() ? name : `${request.method} ${request.path}`;
}

export function eligible(request: ApprovalRequest, now: number = getNow().getTime()): boolean {
  return (
    request.status === "pending" &&
    request.decidedAt === null &&
    now < Date.parse(request.createdAt) + 30 * 60 * 1000
  );
}

export function requestSearch(request: ApprovalRequest): string {
  return `${requestName(request)} ${request.method} ${request.path} ${request.agentName} ${request.status}`;
}
