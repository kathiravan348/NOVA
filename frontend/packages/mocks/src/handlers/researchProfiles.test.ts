import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import {
  ApiErrorSchema,
  DEFAULT_RESEARCH_SETTINGS,
  ResearchProfileSchema,
  ResearchProfileVersionSchema,
} from "@nova/contracts";
import { mockResearchProfiles } from "../data";
import { handlers } from "./index";
import { resetResearchProfiles } from "./researchProfiles";

const server = setupServer(...handlers);
const base = "http://localhost/api/v1/research-profiles";
const sample = `${base}/research_001`;
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetResearchProfiles();
});
afterAll(() => server.close());

function write(path: string, method: string, body?: unknown) {
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("research profile endpoints", () => {
  it("lists and reads the static profile with newest-first versions", async () => {
    expect(ResearchProfileSchema.array().parse(await (await fetch(base)).json())).toEqual(
      mockResearchProfiles,
    );
    expect(ResearchProfileSchema.parse(await (await fetch(sample)).json())).toEqual(
      mockResearchProfiles[0],
    );
  });

  it("stores created profiles, new drafts, edits and freeze in memory", async () => {
    const createdResponse = await write(base, "POST", {
      name: "New plan",
      description: "",
      settings: DEFAULT_RESEARCH_SETTINGS,
    });
    expect(createdResponse.status).toBe(201);
    const created = ResearchProfileSchema.parse(await createdResponse.json());
    const path = `${base}/${created.id}`;
    expect(created.versions[0]?.frozen).toBe(false);
    const settings = structuredClone(DEFAULT_RESEARCH_SETTINGS);
    settings.execution.maxSpreadBps = 6;
    const addedResponse = await write(`${path}/versions`, "POST", {
      note: "Tighter spread",
      settings,
    });
    expect(addedResponse.status).toBe(201);
    const added = ResearchProfileVersionSchema.parse(await addedResponse.json());
    expect(added.version).toBe(2);
    const updated = ResearchProfileVersionSchema.parse(
      await (
        await write(`${path}/versions/2`, "PUT", { settings: DEFAULT_RESEARCH_SETTINGS })
      ).json(),
    );
    expect(updated.note).toBe("Tighter spread");
    expect(updated.settings).toEqual(DEFAULT_RESEARCH_SETTINGS);
    const frozen = ResearchProfileVersionSchema.parse(
      await (await write(`${path}/versions/2/freeze`, "POST")).json(),
    );
    expect(frozen.frozen).toBe(true);
    expect(frozen.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(frozen.frozenAt).not.toBeNull();
    const twice = await write(`${path}/versions/2/freeze`, "POST");
    expect(twice.status).toBe(400);
    expect(ApiErrorSchema.parse(await twice.json()).error.message).toBe(
      "Version is already frozen",
    );
    const edit = await write(`${path}/versions/2`, "PUT", { settings });
    expect(edit.status).toBe(400);
    expect(ApiErrorSchema.parse(await edit.json()).error.message).toBe(
      "Frozen versions cannot change",
    );
    const stored = ResearchProfileSchema.parse(await (await fetch(path)).json());
    expect(stored.versions).toEqual([frozen, created.versions[0]]);
    const list = ResearchProfileSchema.array().parse(await (await fetch(base)).json());
    expect(list[0]).toEqual(stored);
    expect(mockResearchProfiles).toHaveLength(1);
    expect(mockResearchProfiles[0]?.versions[0]?.frozen).toBe(false);
  });

  it("adds versions after the existing newest version", async () => {
    const response = await write(`${sample}/versions`, "POST", {
      note: "Third",
      settings: DEFAULT_RESEARCH_SETTINGS,
    });
    expect(ResearchProfileVersionSchema.parse(await response.json()).version).toBe(3);
    const profile = ResearchProfileSchema.parse(await (await fetch(sample)).json());
    expect(profile.versions.map((version) => version.version)).toEqual([3, 2, 1]);
  });

  it.each([
    ["GET", "/missing"],
    ["POST", "/missing/versions"],
    ["PUT", "/missing/versions/1"],
    ["POST", "/missing/versions/1/freeze"],
    ["PUT", "/research_001/versions/99"],
    ["POST", "/research_001/versions/99/freeze"],
    ["PUT", "/research_001/versions/1.5"],
  ])("returns 404 for %s %s", async (method, path) => {
    const response = await write(base + path, method!);
    expect(response.status).toBe(404);
    expect(ApiErrorSchema.parse(await response.json()).error.code).toBe("not_found");
  });

  it.each([
    ["POST", ""],
    ["POST", "/research_001/versions"],
    ["PUT", "/research_001/versions/2"],
  ])("rejects malformed/invalid bodies for %s %s", async (method, path) => {
    expect((await write(base + path, method!, {})).status).toBe(400);
    expect((await fetch(base + path, { method, body: "invalid json" })).status).toBe(400);
  });

  it("refuses to edit the fixture's frozen version", async () => {
    const response = await write(`${sample}/versions/1`, "PUT", {
      settings: DEFAULT_RESEARCH_SETTINGS,
    });
    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).error.message).toBe(
      "Frozen versions cannot change",
    );
  });
});
