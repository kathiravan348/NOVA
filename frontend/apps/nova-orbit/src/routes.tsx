import { Navigate, type RouteObject } from "react-router";
import { AppLayout, type RouteHandle } from "./layout/AppLayout";
import { RequireAuth } from "./layout/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { BacktestResultPage } from "./pages/backtests/BacktestResultPage";
import { BacktestsPage } from "./pages/backtests/BacktestsPage";
import { NewBacktestPage } from "./pages/backtests/NewBacktestPage";
import { ComparePage } from "./pages/compare/ComparePage";
import { MarketDataPage } from "./pages/market-data/MarketDataPage";
import { EditStrategyPage, NewStrategyPage } from "./pages/editor/StrategyEditorPage";
import { StrategiesPage } from "./pages/strategies/StrategiesPage";
import { StrategyDetailPage } from "./pages/strategies/StrategyDetailPage";

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
          {
            path: "/compare",
            handle: { title: "Compare runs" } satisfies RouteHandle,
            element: <ComparePage />,
          },
          {
            path: "/market-data",
            handle: { title: "Market data" } satisfies RouteHandle,
            element: <MarketDataPage />,
          },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
