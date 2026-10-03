import {
  IdSchema,
  ResearchProfileSchema,
  ResearchProfileCreateSchema,
  ResearchProfileVersionSchema,
  ResearchProfileVersionCreateSchema,
  ResearchProfileVersionUpdateSchema,
  type ResearchProfile,
  type ResearchProfileCreate,
  type ResearchProfileVersion,
  type ResearchProfileVersionCreate,
  type ResearchProfileVersionUpdate,
} from "@nova/contracts";
import { apiGet, apiPost, apiRequest, type RequestOptions } from "../http";

function profilePath(id: string): string {
  return `/research-profiles/${encodeURIComponent(IdSchema.parse(id))}`;
}

function versionPath(id: string, version: number): string {
  if (!Number.isInteger(version) || version < 1)
    throw new Error("Version must be a positive integer");
  return `${profilePath(id)}/versions/${version}`;
}

export function listResearchProfiles(init?: RequestOptions): Promise<ResearchProfile[]> {
  return apiGet("/research-profiles", ResearchProfileSchema.array(), init);
}

export function getResearchProfile(id: string, init?: RequestOptions): Promise<ResearchProfile> {
  return apiGet(profilePath(id), ResearchProfileSchema, init);
}

export function createResearchProfile(
  body: ResearchProfileCreate,
  init?: RequestOptions,
): Promise<ResearchProfile> {
  return apiPost(
    "/research-profiles",
    ResearchProfileCreateSchema.parse(body),
    ResearchProfileSchema,
    init,
  );
}

export function addResearchProfileVersion(
  id: string,
  body: ResearchProfileVersionCreate,
  init?: RequestOptions,
): Promise<ResearchProfileVersion> {
  return apiPost(
    `${profilePath(id)}/versions`,
    ResearchProfileVersionCreateSchema.parse(body),
    ResearchProfileVersionSchema,
    init,
  );
}

export function updateResearchProfileVersion(
  id: string,
  version: number,
  body: ResearchProfileVersionUpdate,
  init?: RequestOptions,
): Promise<ResearchProfileVersion> {
  return apiRequest(
    "PUT",
    versionPath(id, version),
    ResearchProfileVersionUpdateSchema.parse(body),
    ResearchProfileVersionSchema,
    init,
  );
}

export function freezeResearchProfileVersion(
  id: string,
  version: number,
  init?: RequestOptions,
): Promise<ResearchProfileVersion> {
  return apiPost(
    `${versionPath(id, version)}/freeze`,
    undefined,
    ResearchProfileVersionSchema,
    init,
  );
}
