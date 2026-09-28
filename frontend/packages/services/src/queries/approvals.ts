import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AgentAccessUpdate,
  AgentAccountCreate,
  AgentPasswordUpdate,
  ApprovalStatus,
  ApprovalRequest,
} from "@nova/contracts";
import {
  approveRequest,
  rejectRequest,
  listApprovals,
  getAgentAccount,
  createAgentAccount,
  updateAgentPassword,
  updateAgentAccess,
} from "../api/relay";
import { ApiRequestError } from "../http";
import { getNow } from "../clock";
import { queryKeys } from "./keys";
import { cursorQuery, flattenPages, pagedListOptions } from "./paging";

export function useApprovals(status?: ApprovalStatus) {
  return useInfiniteQuery({
    queryKey: queryKeys.approvals.list(status),
    queryFn: ({ signal, pageParam }) =>
      listApprovals({ ...cursorQuery(pageParam), status }, { signal }),
    ...pagedListOptions,
    select: flattenPages,
  });
}

export function useApproveRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveRequest(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.approvals.all }),
  });
}

export function useRejectRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rejectRequest(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.approvals.all }),
  });
}

export function useAgentAccount() {
  return useQuery({
    queryKey: queryKeys.agent,
    queryFn: async ({ signal }) => {
      try {
        return await getAgentAccount({ signal });
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) return null;
        throw error;
      }
    },
  });
}

/** Requests expire 30 minutes after they are created (D67); the server stays authoritative. */
export const APPROVAL_EXPIRY_MS = 30 * 60 * 1000;

export function isApprovalExpired(createdAt: string, now: number = getNow().getTime()): boolean {
  return now >= Date.parse(createdAt) + APPROVAL_EXPIRY_MS;
}

export interface ApprovalOutcome {
  id: string;
  decided: boolean;
  error?: string;
}

/** One explicit decision per request; never retry a write automatically. */
export function useDecideRequests() {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async ({
      requests,
      action,
      onProgress,
    }: {
      requests: Pick<ApprovalRequest, "id" | "createdAt">[];
      action: "Approve" | "Reject";
      onProgress: (outcome: ApprovalOutcome, done: number) => void;
    }) => {
      const outcomes: ApprovalOutcome[] = [];
      for (const request of requests) {
        let outcome: ApprovalOutcome;
        if (isApprovalExpired(request.createdAt)) {
          outcome = { id: request.id, decided: false, error: "Request expired" };
        } else {
          try {
            const result = await (action === "Approve" ? approveRequest : rejectRequest)(
              request.id,
            );
            outcome = {
              id: request.id,
              decided: true,
              ...(result.status === "failed"
                ? {
                    error: `Change failed${result.resultStatus ? ` (HTTP ${result.resultStatus})` : ""}. Open History for the response.`,
                  }
                : {}),
            };
          } catch (error) {
            outcome = {
              id: request.id,
              decided: false,
              error: error instanceof Error ? error.message : "Could not decide request",
            };
          }
        }
        outcomes.push(outcome);
        onProgress(outcome, outcomes.length);
      }
      return outcomes;
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.approvals.all }),
  });
}

/** Password-bearing mutation observers should also reset after each attempt. */
export function useCreateAgentAccount() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: AgentAccountCreate) => createAgentAccount(body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.agent }),
  });
}

export function useUpdateAgentPassword() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: AgentPasswordUpdate) => updateAgentPassword(body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.agent }),
  });
}

export function useUpdateAgentAccess() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: AgentAccessUpdate) => updateAgentAccess(body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.agent }),
  });
}
