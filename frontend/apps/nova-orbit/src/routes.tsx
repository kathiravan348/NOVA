import { Navigate, type RouteObject } from "react-router";
import { AppLayout, type RouteHandle } from "./layout/AppLayout";
import { RequireAuth } from "./layout/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { BacktestResultPage } from "./pages/backtests/BacktestResultPage";
import { BacktestsPage } from "./pages/backtests/BacktestsPage";
import { NewBacktestPage } from "./pages/backtests/NewBacktestPage";
import { EditStrategyPage, NewStrategyPage } from "./pages/editor/StrategyEditorPage";
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
            path: "/strategies/new",
            handle: { title: "New strategy" } satisfies RouteHandle,
            element: <NewStrategyPage />,
          },
          {
            path: "/strategies/:id",
            handle: { title: "Strategy" } satisfies RouteHandle,
            element: <StrategyDetailPage />,
          },
          {
            path: "/strategies/:id/edit",
            handle: { title: "Edit strategy" } satisfies RouteHandle,
            element: <EditStrategyPage />,
          },
          {
            path: "/backtests",
            handle: { title: "Backtests" } satisfies RouteHandle,
            element: <BacktestsPage />,
          },
          {
            path: "/backtests/new",
            handle: { title: "Run backtest" } satisfies RouteHandle,
            element: <NewBacktestPage />,
          },
          {
            path: "/backtests/:id",
            handle: { title: "Backtest" } satisfies RouteHandle,
            element: <BacktestResultPage />,
          },
          page("/compare", "Compare runs"),
          page("/market-data", "Market data"),
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
