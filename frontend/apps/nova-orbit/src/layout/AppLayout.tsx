import type { ReactNode } from "react";
import { Link, Outlet, useLocation, useMatches, useNavigate } from "react-router";
import { BarChart3, CandlestickChart, GitCompare, LogOut, Workflow } from "lucide-react";
import { brand } from "@nova/brand";
import { AppShell, DemoBanner, IconButton, NavItem, ThemeToggle } from "@nova/ui-core";
import { signOut, useSession } from "@nova/services";

const product = brand.products.orbit;

const navItems: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/strategies", label: "Strategies", icon: <Workflow className="h-4 w-4" /> },
  { to: "/backtests", label: "Backtests", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/compare", label: "Compare", icon: <GitCompare className="h-4 w-4" /> },
  { to: "/market-data", label: "Market data", icon: <CandlestickChart className="h-4 w-4" /> },
];

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
        <NavItem
          key={item.to}
          asChild
          active={pathname === item.to || pathname.startsWith(`${item.to}/`)}
          icon={item.icon}
        >
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
