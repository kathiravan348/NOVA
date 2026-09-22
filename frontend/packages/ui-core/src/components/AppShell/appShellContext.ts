import * as React from "react";

export interface AppShellContextValue {
  closeMenu: () => void;
}

export const AppShellContext = React.createContext<AppShellContextValue | null>(null);

export function useAppShell(): AppShellContextValue | null {
  return React.useContext(AppShellContext);
}
