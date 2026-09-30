import { describe, expect, it } from "vitest";
import { pageSchema, IdSchema } from "@nova/contracts";
import { paginate } from "./api";

const url = (query: string) => `http://localhost/api/v1/list?${query}`;
const rows = Array.from({ length: 125 }, (_, i) => `row-${i + 1}`);

describe("offset pagination", () => {
  it("returns rows 51–100, total and a cursor that continues the page", async () => {
    const first = pageSchema(IdSchema).parse(
      await paginate(rows, url("offset=50&limit=50")).json(),
    );
    expect(first.items).toEqual(rows.slice(50, 100));
    expect(first.total).toBe(125);
    const next = pageSchema(IdSchema).parse(
      await paginate(rows, url(`cursor=${first.nextCursor}`)).json(),
    );
    expect(next).toEqual({ items: rows.slice(100), nextCursor: null, total: 125 });
  });

  it("retains the filtered total beyond the last page", async () => {
    expect(await paginate(rows.slice(0, 3), url("offset=50")).json()).toEqual({
      items: [],
      nextCursor: null,
      total: 3,
    });
  });

  it.each(["offset=-1", "offset=1.5", "offset=abc"])("rejects %s with 400", (query) => {
    expect(paginate(rows, url(query)).status).toBe(400);
  });
  it("rejects a cursor combined with offset, including offset zero", () => {
    expect(paginate(rows, url("offset=0&cursor=b2Zmc2V0OjE")).status).toBe(422);
  });
});
