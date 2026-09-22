import type { ReactNode } from "react";
import { Link, Outlet, useLocation, useMatches, useNavigate } from "react-router";
import { Database, Gauge, KeyRound, LayoutDashboard, LogOut, ScrollText } from "lucide-react";
import { brand } from "@nova/brand";
import { AppShell, DemoBanner, IconButton, NavItem, ThemeToggle } from "@nova/ui-core";
import { signOut, useSession } from "@nova/services";

const product = brand.products.relay;

const navItems: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/accounts", label: "Broker accounts", icon: <KeyRound className="h-4 w-4" /> },
  { to: "/rate-limits", label: "Rate limits", icon: <Gauge className="h-4 w-4" /> },
  { to: "/data-jobs", label: "Data jobs", icon: <Database className="h-4 w-4" /> },
  { to: "/audit", label: "Audit log", icon: <ScrollText className="h-4 w-4" /> },
];

const isActive = (pathname: string, to: string) =>
  to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

export interface RouteHandle {
  title: string;
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
  const navigate = useNavigate();
  const title = usePageTitle();
  const { pathname } = useLocation();

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <AppShell
      brand={<span className="text-card-title text-text-primary">{product.name}</span>}
      banner={<DemoBanner />}
      title={<h1 className="text-section-title">{title}</h1>}
      nav={navItems.map((item) => (
        <NavItem key={item.to} asChild active={isActive(pathname, item.to)} icon={item.icon}>
          <Link to={item.to}>{item.label}</Link>
        </NavItem>
      ))}
      actions={
        <>
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
