import { useEffect, type ReactNode } from "react";
import { Link, Outlet, useLocation, useMatches, useNavigate } from "react-router";
import {
  Activity,
  Database,
  HardDrive,
  Radio,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { brand } from "@nova/brand";
import { AppShell, DemoBanner, IconButton, NavItem, StatusBadge, ThemeToggle } from "@nova/ui-core";
import { getDataMode, signOut, useApprovals, useRealtimeStatus, useSession } from "@nova/services";

const product = brand.products.relay;

const navItems: { to: string; label: string; icon: ReactNode; group?: string }[] = [
  { to: "/", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/broker", label: "Broker", icon: <Landmark className="h-4 w-4" /> },
  { to: "/instruments", label: "Instruments", icon: <ListOrdered className="h-4 w-4" /> },
  { to: "/stored-data", label: "Stored data", icon: <HardDrive className="h-4 w-4" /> },
  { to: "/data-jobs", label: "Data jobs", icon: <Database className="h-4 w-4" /> },
  { to: "/live/monitor", label: "Monitor", icon: <Activity className="h-4 w-4" />, group: "Live" },
  {
    to: "/live/recorded",
    label: "Recorded data",
    icon: <Radio className="h-4 w-4" />,
    group: "Live",
  },
  { to: "/audit", label: "Audit log", icon: <ScrollText className="h-4 w-4" /> },
  { to: "/approvals", label: "Approvals", icon: <ShieldCheck className="h-4 w-4" /> },
];

const isActive = (pathname: string, to: string) =>
  to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

export interface RouteHandle {
  title: string;
}

/** Live-updates dot (D57): shown only while the app keeps a socket (real mode, signed in). */
function LiveStatus() {
  const status = useRealtimeStatus();
  if (status === "off") return null;
  const badge = {
    connecting: { tone: "neutral", label: "Connecting…", title: "Starting live updates" },
    open: { tone: "success", label: "Live", title: "Job updates appear as they happen" },
    down: {
      tone: "warning",
      label: "Reconnecting…",
      title: "Live updates paused; the page refreshes every few seconds",
    },
  } as const;
  return <StatusBadge {...badge[status]} />;
}

function usePageTitle(): string {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const handle = matches[i]!.handle as RouteHandle | undefined;
    if (handle?.title) return handle.title;
  }
  return product.short;
}

export function AppLayout() {
  const session = useSession();
  const agent = session?.role === "agent";
  const pending = useApprovals("pending");
  const { refetch, fetchNextPage, hasNextPage, isFetching } = pending;
  useEffect(() => {
    const timer = setInterval(() => void refetch(), 5000);
    return () => clearInterval(timer);
  }, [refetch]);
  useEffect(() => {
    if (hasNextPage && !isFetching) void fetchNextPage();
  }, [hasNextPage, isFetching, fetchNextPage]);
  const navigate = useNavigate();
  const title = usePageTitle();
  const { pathname } = useLocation();

  const handleSignOut = () => {
    void signOut().then(() => navigate("/login", { replace: true }));
  };

  return (
    <AppShell
      brand={<span className="text-card-title text-text-primary">{product.name}</span>}
      banner={
        getDataMode() === "mock" ? (
          <DemoBanner />
        ) : agent ? (
          <DemoBanner>Agent account: changes wait for Admin approval</DemoBanner>
        ) : undefined
      }
      title={<h1 className="text-section-title">{title}</h1>}
      nav={navItems
        .filter((item) => !agent || (item.to !== "/broker" && !item.group))
        .map((item, i, items) => (
          <div key={item.to} className="contents">
            {item.group && items[i - 1]?.group !== item.group && (
              <p className="px-3 pt-4 pb-1 text-body-sm text-text-muted">{item.group}</p>
            )}
            <NavItem asChild active={isActive(pathname, item.to)} icon={item.icon}>
              <Link to={item.to}>
                {item.label}
                {item.to === "/approvals" && pending.data ? ` (${pending.data.length})` : ""}
              </Link>
            </NavItem>
          </div>
        ))}
      actions={
        <>
          <LiveStatus />
          <span className="hidden sm:inline text-body-sm text-text-secondary">
            {session?.displayName}
          </span>
          <ThemeToggle />
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Sign out"
            icon={<LogOut className="h-4 w-4" />}
            onClick={handleSignOut}
          />
        </>
      }
    >
      <Outlet />
    </AppShell>
  );
}
