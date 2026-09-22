import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router";
import { setupServer } from "msw/node";
import { handlers, mockUser } from "@nova/mocks";
import { createQueryClient, signOut } from "@nova/services";
import { routes } from "./routes";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  signOut();
});
afterAll(() => server.close());

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

async function signInWithForm() {
  fireEvent.change(await screen.findByLabelText(/Username/), { target: { value: "aarav" } });
  fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "pw" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("Relay routes", () => {
  it("redirects a signed-out visitor to /login with next", async () => {
    const router = renderAt("/audit");
    await screen.findByRole("button", { name: "Sign in" });
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe("?next=%2Faudit");
  });

  it("signs in, lands on next and shows the nav", async () => {
    const router = renderAt("/rate-limits");
    await signInWithForm();
    expect(await screen.findByRole("heading", { name: "Rate limits" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/rate-limits");
    expect(screen.getAllByRole("link", { name: "Broker accounts" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(mockUser.name).length).toBeGreaterThan(0);
  });

  it("lands on Overview by default, and sign-out returns to /login", async () => {
    const router = renderAt("/login");
    await signInWithForm();
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });
});
