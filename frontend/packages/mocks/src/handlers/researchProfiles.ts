import { http, HttpResponse } from "msw";
import {
  ResearchProfileCreateSchema,
  ResearchProfileVersionCreateSchema,
  ResearchProfileVersionUpdateSchema,
  type ResearchProfile,
  type ResearchProfileVersion,
  type ResearchSettings,
} from "@nova/contracts";
import { mockResearchProfiles, MOCK_NOW } from "../data";
import { apiPath, badRequest, notFound } from "./api";

let profiles: ResearchProfile[] = structuredClone(mockResearchProfiles);

/** Reset in-memory demo writes without mutating the static fixtures. */
export function resetResearchProfiles(): void {
  profiles = structuredClone(mockResearchProfiles);
}

function draft(version: number, note: string, settings: ResearchSettings): ResearchProfileVersion {
  return {
    version,
    note,
    settings,
    frozen: false,
    hash: null,
    createdAt: MOCK_NOW,
    frozenAt: null,
  };
}

function findVersion(id: string, rawVersion: string) {
  const profile = profiles.find((item) => item.id === id);
  const version = /^\d+$/.test(rawVersion)
    ? profile?.versions.find((item) => item.version === Number(rawVersion))
    : undefined;
  return profile && version ? { profile, version } : undefined;
}

function saveVersion(profile: ResearchProfile, version: ResearchProfileVersion): Response {
  profile.versions = profile.versions.map((item) =>
    item.version === version.version ? version : item,
  );
  profile.updatedAt = MOCK_NOW;
  return HttpResponse.json(version);
}

export const researchProfileHandlers = [
  http.get(apiPath("/research-profiles"), () => HttpResponse.json(profiles)),
  http.post(apiPath("/research-profiles"), async ({ request }) => {
    const parsed = ResearchProfileCreateSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) return badRequest(parsed.error.issues[0]!.message);
    const { settings, ...body } = parsed.data;
    const profile: ResearchProfile = {
      ...body,
      id: `research_demo_${profiles.length + 1}`,
      versions: [draft(1, "", settings)],
      createdAt: MOCK_NOW,
      updatedAt: MOCK_NOW,
    };
    profiles.unshift(profile);
    return HttpResponse.json(profile, { status: 201 });
  }),
  http.get(apiPath("/research-profiles/:id"), ({ params }) => {
    const profile = profiles.find((item) => item.id === params["id"]);
    return profile ? HttpResponse.json(profile) : notFound("Research profile not found");
  }),
  http.post(apiPath("/research-profiles/:id/versions"), async ({ params, request }) => {
    const profile = profiles.find((item) => item.id === params["id"]);
    if (!profile) return notFound("Research profile not found");
    const parsed = ResearchProfileVersionCreateSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) return badRequest(parsed.error.issues[0]!.message);
    const version = draft(profile.versions[0]!.version + 1, parsed.data.note, parsed.data.settings);
    profile.versions.unshift(version);
    profile.updatedAt = MOCK_NOW;
    return HttpResponse.json(version, { status: 201 });
  }),
  http.put(apiPath("/research-profiles/:id/versions/:version"), async ({ params, request }) => {
    const found = findVersion(String(params["id"]), String(params["version"]));
    if (!found) return notFound("Research profile version not found");
    if (found.version.frozen) return badRequest("Frozen versions cannot change");
    const parsed = ResearchProfileVersionUpdateSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) return badRequest(parsed.error.issues[0]!.message);
    return saveVersion(found.profile, { ...found.version, settings: parsed.data.settings });
  }),
  http.post(apiPath("/research-profiles/:id/versions/:version/freeze"), ({ params }) => {
    const found = findVersion(String(params["id"]), String(params["version"]));
    if (!found) return notFound("Research profile version not found");
    if (found.version.frozen) return badRequest("Version is already frozen");
    // Demo hash is fixed; canonical SHA-256 hashing belongs to the backend (NOVA-184).
    return saveVersion(found.profile, {
      ...found.version,
      frozen: true,
      hash: "b".repeat(64),
      frozenAt: MOCK_NOW,
    });
  }),
];
