import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AgentAccessUpdate,
  AgentAccountCreate,
  AgentPasswordUpdate,
  ApprovalStatus,
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
