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
import { ConfigPage } from "./pages/live/ConfigPage";
import { MonitorPage } from "./pages/live/MonitorPage";
import { RecordedDataPage } from "./pages/live/RecordedDataPage";
import { RecordedStockPage } from "./pages/live/RecordedStockPage";
import { OverviewPage } from "./pages/overview/OverviewPage";
import { StoredDataPage } from "./pages/stored-data/StoredDataPage";
import { ApprovalsPage } from "./pages/approvals/ApprovalsPage";
import { useSession } from "@nova/services";

function BrokerOnly({ children }: { children: ReactNode }) {
  return useSession()?.role === "agent" ? <Navigate to="/" replace /> : children;
}

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
          page(
            "/broker",
            "Broker",
            <BrokerOnly>
              <BrokerPage />
            </BrokerOnly>,
          ),
          page(
            "/broker/:id",
            "Broker account",
            <BrokerOnly>
              <AccountDetailPage />
            </BrokerOnly>,
          ),
          {
            path: "/broker/*",
            element: (
              <BrokerOnly>
                <Navigate to="/broker" replace />
              </BrokerOnly>
            ),
          },
          { path: "/accounts", element: <Navigate to="/broker" replace /> },
          { path: "/accounts/:id", element: <OldAccountRedirect /> },
          { path: "/rate-limits", element: <Navigate to="/broker" replace /> },
          page("/instruments", "Instruments", <InstrumentsPage />),
          page("/stored-data", "Stored data", <StoredDataPage />),
          page("/data-jobs", "Data jobs", <DataJobsPage />),
          page("/data-jobs/new", "New download", <NewDownloadPage />),
          page("/data-jobs/:id", "Data job", <DataJobDetailPage />),
          page(
            "/live/monitor",
            "Live monitor",
            <BrokerOnly>
              <MonitorPage />
            </BrokerOnly>,
          ),
          page(
            "/live/recorded",
            "Recorded data",
            <BrokerOnly>
              <RecordedDataPage />
            </BrokerOnly>,
          ),
          page(
            "/live/recorded/:symbol",
            "Recorded data",
            <BrokerOnly>
              <RecordedStockPage />
            </BrokerOnly>,
          ),
          page(
            "/live/config",
            "Live config",
            <BrokerOnly>
              <ConfigPage />
            </BrokerOnly>,
          ),
          { path: "/live", element: <Navigate to="/live/monitor" replace /> },
          page("/audit", "Audit log", <AuditPage />),
          page("/approvals", "Approvals", <ApprovalsPage />),
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
