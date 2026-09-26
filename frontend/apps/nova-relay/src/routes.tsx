import type { ReactNode } from "react";
import { Navigate, useLocation, useParams, type RouteObject } from "react-router";
import { AppLayout, type RouteHandle } from "./layout/AppLayout";
import { RequireAuth } from "./layout/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { AuditPage } from "./pages/audit/AuditPage";
import { AccountDetailPage } from "./pages/broker/AccountDetailPage";
import { BrokerPage } from "./pages/broker/BrokerPage";
import { DataJobDetailPage } from "./pages/data-jobs/DataJobDetailPage";
import { DataJobsPage } from "./pages/data-jobs/DataJobsPage";
import { NewDownloadPage } from "./pages/data-jobs/NewDownloadPage";
import { InstrumentsPage } from "./pages/instruments/InstrumentsPage";
import { OverviewPage } from "./pages/overview/OverviewPage";

const page = (path: string, title: string, element: ReactNode): RouteObject => ({
  path,
  handle: { title } satisfies RouteHandle,
  element,
});

/** Old `/accounts/:id` links (and the Kite callback until NOVA-081) keep their `?kite=` result (D55). */
function OldAccountRedirect() {
  const { id = "" } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/broker/${id}${search}`} replace />;
}

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
          page("/broker", "Broker", <BrokerPage />),
          page("/broker/:id", "Broker account", <AccountDetailPage />),
          { path: "/accounts", element: <Navigate to="/broker" replace /> },
          { path: "/accounts/:id", element: <OldAccountRedirect /> },
          { path: "/rate-limits", element: <Navigate to="/broker" replace /> },
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
