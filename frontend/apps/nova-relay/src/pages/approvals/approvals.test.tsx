import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers, mockAgentAccount, mockApprovals } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
let calls: string[] = [];
server.events.on("request:start", ({ request }) =>
  calls.push(`${request.method} ${new URL(request.url).pathname}`),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  calls = [];
});
afterAll(() => server.close());

describe("Approvals", () => {
  it.each(["Approve", "Reject"] as const)("confirms %s before calling the API", async (action) => {
    renderApp("/approvals");
    expect(await screen.findByText("Agent backtest", { exact: false })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Approvals (1)" })).toBeInTheDocument();
    expect(screen.getByText("HTTP 200 · {}", { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: action }));
    const dialog = await screen.findByRole("dialog", { name: `${action} this request?` });
    expect(calls).not.toContain(`POST /api/v1/approvals/approval_pending/${action.toLowerCase()}`);
    fireEvent.click(within(dialog).getByRole("button", { name: action }));
    await waitFor(() =>
      expect(calls).toContain(`POST /api/v1/approvals/approval_pending/${action.toLowerCase()}`),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows failed decisions through the error toast", async () => {
    server.use(
      http.post("*/api/v1/approvals/:id/approve", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "Request expired" } },
          { status: 400 },
        ),
      ),
    );
    renderApp("/approvals");
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Request expired")).toBeInTheDocument();
  });

  it("loads older history including failed and expired requests", async () => {
    server.use(
      http.get("*/api/v1/approvals", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("status"))
          return HttpResponse.json({ items: [mockApprovals[0]], nextCursor: null });
        const older = url.searchParams.has("cursor");
        return HttpResponse.json({
          items: older
            ? [
                {
                  ...mockApprovals[1],
                  id: "failed",
                  status: "failed",
                  resultStatus: 400,
                  resultBody: "Invalid strategy",
                },
                { ...mockApprovals[2], id: "expired", status: "expired" },
              ]
            : [mockApprovals[1]],
          nextCursor: older ? null : "older",
        });
      }),
    );
    renderApp("/approvals");
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByText("HTTP 400 · Invalid strategy")).toBeInTheDocument();
    expect(screen.getByText("expired")).toBeInTheDocument();
  });

  it("keeps the agent view read-only without account calls", async () => {
    sessionStorage.setItem(
      "nova-session",
      JSON.stringify({ userId: "usr_agent", displayName: "Debug Agent", role: "agent" }),
    );
    renderApp("/approvals", { signedIn: false });
    await screen.findByText("Agent backtest", { exact: false });
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.queryByText("Agent account")).not.toBeInTheDocument();
    expect(calls).not.toContain("GET /api/v1/agent");
    expect(screen.getByRole("note")).toHaveTextContent("Demo data");
  });
});

describe("Agent account", () => {
  it("validates and creates an agent when none exists", async () => {
    let created = false;
    server.use(
      http.get("*/api/v1/agent", () =>
        created
          ? HttpResponse.json(mockAgentAccount)
          : HttpResponse.json(
              { error: { code: "not_found", message: "No agent" } },
              { status: 404 },
            ),
      ),
      http.post("*/api/v1/agent", () => {
        created = true;
        return HttpResponse.json(mockAgentAccount, { status: 201 });
      }),
    );
    renderApp("/approvals");
    fireEvent.click(await screen.findByRole("button", { name: "Create agent" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Debug Agent" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "agent@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(calls).not.toContain("POST /api/v1/agent");
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));
    expect(await screen.findByText("Passwords must match.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "test-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));
    expect(await screen.findByRole("switch", { name: "Agent access" })).toBeInTheDocument();
    expect(calls).toContain("POST /api/v1/agent");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("updates access and the password and displays server errors", async () => {
    server.use(
      http.put("*/api/v1/agent/password", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "Password refused" } },
          { status: 400 },
        ),
      ),
    );
    renderApp("/approvals");
    fireEvent.click(await screen.findByRole("switch", { name: "Agent access" }));
    await waitFor(() => expect(calls).toContain("PATCH /api/v1/agent"));
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    for (const label of ["Password", "Confirm password"])
      fireEvent.change(screen.getByLabelText(label), { target: { value: "test-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByText("Password refused")).toBeInTheDocument();
    expect(calls).toContain("PUT /api/v1/agent/password");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });
});
