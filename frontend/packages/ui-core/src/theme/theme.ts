export type ThemeName = "dark" | "light";

const STORAGE_KEY = "nova-theme";

export function getStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable or restricted
  }
  return "dark";
}

export function applyTheme(name: ThemeName): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset["theme"] = name;
  }
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // localStorage may be unavailable or restricted
  }
}
