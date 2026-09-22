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
          { index: true, element: <Navigate to="/strategies" replace /> },
          page("/strategies", "Strategies"),
          page("/backtests", "Backtests"),
          page("/compare", "Compare runs"),
          page("/market-data", "Market data"),
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
