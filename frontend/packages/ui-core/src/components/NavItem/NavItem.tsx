import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cn } from "../../lib/cn";
import { useAppShell } from "../AppShell/appShellContext";

export interface NavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
  asChild?: boolean;
  children: React.ReactNode;
}

export const NavItem = React.forwardRef<HTMLButtonElement, NavItemProps>(
  ({ icon, active = false, asChild = false, className, children, onClick, ...props }, ref) => {
    const appShell = useAppShell();
    const Comp = asChild ? Slot : "button";

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      appShell?.closeMenu();
    };

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        aria-current={active ? "page" : undefined}
        onClick={handleClick}
        className={cn(
          "flex items-center gap-3 w-full px-3 h-(--nav-item-height) rounded-md text-body font-sans text-text-secondary transition-colors hover:text-text-primary hover:bg-bg-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action cursor-pointer select-none text-left",
          active && "bg-action-subtle text-text-primary hover:bg-action-subtle font-medium",
          className,
        )}
        {...props}
      >
        {icon && (
          <span
            className="shrink-0 flex items-center justify-center text-text-muted"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        {asChild ? <Slottable>{children}</Slottable> : <span className="truncate">{children}</span>}
      </Comp>
    );
  },
);

NavItem.displayName = "NavItem";
