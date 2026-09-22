import { Navigate, type RouteObject } from "react-router";
import { AppLayout, type RouteHandle } from "./layout/AppLayout";
import { RequireAuth } from "./layout/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { StrategiesPage } from "./pages/strategies/StrategiesPage";
import { StrategyDetailPage } from "./pages/strategies/StrategyDetailPage";

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
          {
            path: "/strategies",
            handle: { title: "Strategies" } satisfies RouteHandle,
            element: <StrategiesPage />,
          },
          {
            path: "/strategies/:id",
            handle: { title: "Strategy" } satisfies RouteHandle,
            element: <StrategyDetailPage />,
          },
          page("/backtests", "Backtests"),
          page("/compare", "Compare runs"),
          page("/market-data", "Market data"),
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
