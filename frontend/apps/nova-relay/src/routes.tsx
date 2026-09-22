import { Navigate, type RouteObject } from "react-router";
import { AppLayout, type RouteHandle } from "./layout/AppLayout";
import { RequireAuth } from "./layout/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const page = (path: string, title: string): RouteObject => ({
  path,
  handle: { title } satisfies RouteHandle,
  element: <PlaceholderPage title={title} />,
});

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            handle: { title: "Overview" } satisfies RouteHandle,
            element: <PlaceholderPage title="Overview" />,
          },
          page("/accounts", "Broker accounts"),
          page("/rate-limits", "Rate limits"),
          page("/data-jobs", "Data jobs"),
          page("/audit", "Audit log"),
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
