import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ResearchProfileCreate,
  ResearchProfileVersionCreate,
  ResearchProfileVersionUpdate,
} from "@nova/contracts";
import {
  listResearchProfiles,
  getResearchProfile,
  createResearchProfile,
  addResearchProfileVersion,
  updateResearchProfileVersion,
  freezeResearchProfileVersion,
} from "../api/research";
import { queryKeys } from "./keys";

export function useResearchProfiles() {
  return useQuery({
    queryKey: queryKeys.research.list,
    queryFn: ({ signal }) => listResearchProfiles({ signal }),
  });
}

export function useResearchProfile(id: string | null) {
  return useQuery({
    queryKey: queryKeys.research.detail(id ?? ""),
    queryFn: ({ signal }) => getResearchProfile(id ?? "", { signal }),
    enabled: Boolean(id),
  });
}

export function useCreateResearchProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ResearchProfileCreate) => createResearchProfile(body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.research.all }),
  });
}

export function useAddResearchProfileVersion(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ResearchProfileVersionCreate) => addResearchProfileVersion(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.research.all }),
  });
}

export function useUpdateResearchProfileVersion(id: string, version: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ResearchProfileVersionUpdate) =>
      updateResearchProfileVersion(id, version, body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.research.all }),
  });
}

export function useFreezeResearchProfileVersion(id: string, version: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => freezeResearchProfileVersion(id, version),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.research.all }),
  });
}
