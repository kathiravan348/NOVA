import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { IconButton, type IconButtonProps } from "../IconButton/IconButton";
import { applyTheme, getStoredTheme, type ThemeName } from "../../theme/theme";

export interface ThemeToggleProps extends Omit<IconButtonProps, "icon" | "aria-label"> {
  className?: string;
}

export function ThemeToggle({
  className,
  size = "md",
  ...props
}: ThemeToggleProps): React.ReactElement {
  const [theme, setTheme] = React.useState<ThemeName>("dark");

  React.useEffect(() => {
    const current = (document.documentElement.dataset["theme"] as ThemeName) || getStoredTheme();
    setTheme(current);
  }, []);

  const toggle = () => {
    const nextTheme: ThemeName = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  };

  const isDark = theme === "dark";
  const ariaLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <IconButton
      variant="ghost"
      size={size}
      aria-label={ariaLabel}
      icon={isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      onClick={toggle}
      className={className}
      {...props}
    />
  );
}
