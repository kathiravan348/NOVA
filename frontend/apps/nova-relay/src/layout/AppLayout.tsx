import type { ReactNode } from "react";
import { Link, Outlet, useLocation, useMatches, useNavigate } from "react-router";
import { Database, Landmark, LayoutDashboard, ListOrdered, LogOut, ScrollText } from "lucide-react";
import { brand } from "@nova/brand";
import { AppShell, DemoBanner, IconButton, NavItem, ThemeToggle } from "@nova/ui-core";
import { getDataMode, signOut, useSession } from "@nova/services";

const product = brand.products.relay;

const navItems: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/broker", label: "Broker", icon: <Landmark className="h-4 w-4" /> },
  { to: "/instruments", label: "Instruments", icon: <ListOrdered className="h-4 w-4" /> },
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
    void signOut().then(() => navigate("/login", { replace: true }));
  };

  return (
    <AppShell
      brand={<span className="text-card-title text-text-primary">{product.name}</span>}
      banner={getDataMode() === "mock" ? <DemoBanner /> : undefined}
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
