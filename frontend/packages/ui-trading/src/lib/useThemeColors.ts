import * as React from "react";

function readVars(names: readonly string[]): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    names.map((name) => [name, style.getPropertyValue(`--${name}`).trim()]),
  );
}

/**
 * Reads theme CSS variables (without the leading `--`) from `<html>` and re-reads them when
 * `data-theme` changes, for libraries that need resolved colour strings instead of `var()`.
 */
export function useThemeColors(names: readonly string[]): Record<string, string> {
  const key = names.join("|");
  const [colors, setColors] = React.useState(() => readVars(names));

  React.useEffect(() => {
    const list = key.split("|");
    setColors(readVars(list));
    const observer = new MutationObserver(() => setColors(readVars(list)));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [key]);

  return colors;
}
