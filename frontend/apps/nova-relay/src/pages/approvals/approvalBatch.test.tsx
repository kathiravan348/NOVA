import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ApprovalRequest } from "@nova/contracts";
import { handlers, mockApprovals } from "@nova/mocks";
import * as clock from "../../../../../packages/services/src/clock";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
const initial = Date.parse("2026-09-21T06:30:00Z");
let rows: ApprovalRequest[] = [];
let writes: string[] = [];
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
  sessionStorage.clear();
  writes = [];
});
afterAll(() => server.close());

function pending(count: number): ApprovalRequest[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockApprovals[0]!,
    id: `request_${i}`,
    body: { name: `Batch request ${i}`, secretDetail: "expanded only" },
  }));
}
function mount(data: ApprovalRequest[]) {
  rows = data;
  server.use(
    http.get("*/api/v1/approvals", ({ request }) => {
      const status = new URL(request.url).searchParams.get("status");
      return HttpResponse.json({
        items: status ? rows.filter((row) => row.status === status) : rows,
        nextCursor: null,
      });
    }),
    http.post("*/api/v1/approvals/:id/:action", ({ params }) => {
      const id = String(params["id"]);
      writes.push(id);
      const row = rows.find((entry) => entry.id === id)!;
      const result = {
        ...row,
        status: params["action"] === "approve" ? "done" : "rejected",
        decidedAt: clock.getNow().toISOString(),
        decidedBy: "Admin",
        resultStatus: 201,
        resultBody: "{}",
      };
      rows = rows.map((entry) => (entry.id === id ? (result as ApprovalRequest) : entry));
      return HttpResponse.json(result);
    }),
  );
  return renderApp("/approvals");
}
async function chooseAll(action: "Approve" | "Reject", count: number) {
  await screen.findAllByText("Batch request 0");
  fireEvent.click(screen.getByRole("button", { name: "Select all shown" }));
  fireEvent.click(screen.getByRole("button", { name: `${action} selected (${count})` }));
  return screen.getByRole("dialog");
}

describe("Approval batches", () => {
  it.each(["Approve", "Reject"] as const)(
    "%s processes 50 selected requests once after one confirmation",
    async (action) => {
      mount(pending(50));
      const dialog = await chooseAll(action, 50);
      expect(writes).toEqual([]);
      expect(within(dialog).getByLabelText("Selected requests")).toHaveTextContent(
        "Batch request 49",
      );
      fireEvent.click(within(dialog).getByRole("button", { name: action }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), {
        timeout: 10000,
      });
      expect(writes).toHaveLength(50);
      expect(new Set(writes).size).toBe(50);
      expect(screen.getByRole("button", { name: "Approve selected (0)" })).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent("50 of 50");
    },
  );

  it("selects filtered rows and reveals the full body only on demand", async () => {
    mount(pending(12));
    await screen.findAllByText("Batch request 0");
    expect(screen.getByText("Showing 1–10 of 12")).toBeInTheDocument();
    expect(screen.queryByText("expanded only")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search requests"), { target: { value: "request 11" } });
    fireEvent.click(screen.getByRole("button", { name: "Select all shown" }));
    expect(screen.getByRole("button", { name: "Approve selected (1)" })).toBeEnabled();
    fireEvent.click(screen.getAllByRole("button", { name: "View details" })[0]!);
    expect(within(screen.getByRole("dialog")).getByLabelText("Request body")).toHaveTextContent(
      "expanded only",
    );
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve selected (1)" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(writes).toEqual(["request_11"]));
  });

  it("continues after an HTTP failure and never resubmits successful requests", async () => {
    mount(pending(3));
    server.use(
      http.post("*/api/v1/approvals/request_1/approve", () => {
        writes.push("request_1");
        return HttpResponse.json(
          { error: { code: "invalid_request", message: "Request refused" } },
          { status: 400 },
        );
      }),
    );
    const dialog = await chooseAll("Approve", 3);
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(writes).toEqual(["request_0", "request_1", "request_2"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Request refused");
    fireEvent.click(screen.getByRole("button", { name: "Approve selected (1)" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(writes).toEqual(["request_0", "request_1", "request_2", "request_1"]),
    );
  });

  it("reports an upstream failure as decided and does not offer to replay it", async () => {
    mount(pending(1));
    server.use(
      http.post("*/api/v1/approvals/request_0/approve", () => {
        writes.push("request_0");
        return HttpResponse.json({
          ...rows[0],
          status: "failed",
          decidedAt: clock.getNow().toISOString(),
          decidedBy: "Admin",
          resultStatus: 400,
          resultBody: "Invalid change",
        });
      }),
    );
    const dialog = await chooseAll("Approve", 1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Change failed (HTTP 400)");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Approve selected (0)" })).toBeDisabled(),
    );
    expect(writes).toEqual(["request_0"]);
  });

  it("excludes stale and already-decided requests, and rechecks expiry at confirmation", async () => {
    let now = initial;
    vi.spyOn(clock, "getNow").mockImplementation(() => new Date(now));
    const data = pending(3);
    data[1] = { ...data[1]!, createdAt: new Date(initial - 31 * 60000).toISOString() };
    data[2] = { ...data[2]!, decidedAt: new Date(initial).toISOString() };
    mount(data);
    const dialog = await chooseAll("Approve", 1);
    now += 31 * 60000;
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(writes).toEqual([]);
  });

  it("skips requests that expire during processing and freezes the confirmed IDs", async () => {
    let now = initial;
    vi.spyOn(clock, "getNow").mockImplementation(() => new Date(now));
    mount(pending(2));
    server.use(
      http.post("*/api/v1/approvals/request_0/approve", () => {
        writes.push("request_0");
        now += 31 * 60000;
        rows.push({ ...pending(1)[0]!, id: "new_arrival", createdAt: new Date(now).toISOString() });
        return HttpResponse.json({
          ...rows[0],
          status: "done",
          decidedAt: new Date(now).toISOString(),
          decidedBy: "Admin",
          resultStatus: 201,
          resultBody: "{}",
        });
      }),
    );
    const dialog = await chooseAll("Approve", 2);
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(writes).toEqual(["request_0"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Request expired");
  });

  it("disables competing decisions and tabs while a batch is running", async () => {
    mount(pending(1));
    const historyTab = screen.getByRole("tab", { name: "History" });
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post("*/api/v1/approvals/request_0/approve", async () => {
        await gate;
        return HttpResponse.json({
          ...rows[0],
          status: "done",
          decidedAt: clock.getNow().toISOString(),
          decidedBy: "Admin",
          resultStatus: 201,
          resultBody: "{}",
        });
      }),
    );
    const dialog = await chooseAll("Approve", 1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(historyTab).toBeDisabled());
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    release!();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
