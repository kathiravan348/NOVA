import { Navigate, Outlet, useLocation } from "react-router";
import { useSession } from "@nova/services";

export function RequireAuth() {
  const session = useSession();
  const location = useLocation();
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
