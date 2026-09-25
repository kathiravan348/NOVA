import type { ReactNode } from "react";
import { Navigate, type RouteObject } from "react-router";
import { AppLayout, type RouteHandle } from "./layout/AppLayout";
import { RequireAuth } from "./layout/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { AccountDetailPage } from "./pages/accounts/AccountDetailPage";
import { AccountsPage } from "./pages/accounts/AccountsPage";
import { AuditPage } from "./pages/audit/AuditPage";
import { BrokerPage } from "./pages/broker/BrokerPage";
import { DataJobDetailPage } from "./pages/data-jobs/DataJobDetailPage";
import { DataJobsPage } from "./pages/data-jobs/DataJobsPage";
import { NewDownloadPage } from "./pages/data-jobs/NewDownloadPage";
import { InstrumentsPage } from "./pages/instruments/InstrumentsPage";
import { OverviewPage } from "./pages/overview/OverviewPage";
import { RateLimitsPage } from "./pages/rate-limits/RateLimitsPage";

const page = (path: string, title: string, element: ReactNode): RouteObject => ({
  path,
  handle: { title } satisfies RouteHandle,
  element,
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
            element: <OverviewPage />,
          },
          page("/accounts", "Broker accounts", <AccountsPage />),
          page("/accounts/:id", "Broker account", <AccountDetailPage />),
          page("/broker", "Broker", <BrokerPage />),
          page("/rate-limits", "Rate limits", <RateLimitsPage />),
          page("/instruments", "Instruments", <InstrumentsPage />),
          page("/data-jobs", "Data jobs", <DataJobsPage />),
          page("/data-jobs/new", "New download", <NewDownloadPage />),
          page("/data-jobs/:id", "Data job", <DataJobDetailPage />),
          page("/audit", "Audit log", <AuditPage />),
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
