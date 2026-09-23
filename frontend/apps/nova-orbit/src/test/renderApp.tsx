import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router";
import { mockUser } from "@nova/mocks";
import { createQueryClient } from "@nova/services";
import { ToastProvider } from "@nova/ui-core";
import { routes } from "../routes";

/** Renders the real app routes at `path`, signed in unless told otherwise. Start MSW yourself. */
export function renderApp(path: string, { signedIn = true }: { signedIn?: boolean } = {}) {
  if (signedIn) {
    sessionStorage.setItem(
      "nova-session",
      JSON.stringify({ userId: mockUser.id, displayName: mockUser.name }),
    );
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <QueryClientProvider client={createQueryClient()}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { router, ...utils };
}
