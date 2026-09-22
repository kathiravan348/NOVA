import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fails lint when a component uses a colour, text-size or radius utility the theme does not
 * define. tailwind-theme.css resets those namespaces to `initial`, so an unknown name
 * (e.g. `ring-focus-ring`, `text-title`) silently renders nothing.
 */

export interface ThemeNames {
  colors: Set<string>;
  texts: Set<string>;
  radii: Set<string>;
}

const COLOR_KEYWORDS = new Set(["current", "transparent", "inherit"]);
const TEXT_WORDS = new Set([
  "left",
  "center",
  "right",
  "justify",
  "start",
  "end",
  "wrap",
  "nowrap",
  "balance",
  "pretty",
  "ellipsis",
  "clip",
]);
const BG_WORDS = new Set([
  "none",
  "auto",
  "cover",
  "contain",
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "fixed",
  "local",
  "scroll",
  "repeat",
  "no-repeat",
  "repeat-x",
  "repeat-y",
]);
const BG_PREFIXES = ["clip-", "origin-", "linear-", "radial-", "conic-", "gradient-", "blend-"];
const LINE_STYLES = new Set(["solid", "dashed", "dotted", "double", "hidden", "none"]);
const BORDER_SIDES = new Set(["x", "y", "t", "r", "b", "l", "s", "e"]);
const RADIUS_SIDES = new Set([
  "t",
  "r",
  "b",
  "l",
  "s",
  "e",
  "tl",
  "tr",
  "br",
  "bl",
  "ss",
  "se",
  "es",
  "ee",
]);
const RADIUS_WORDS = new Set(["none", "full"]);

const isWidth = (v: string) => /^\d+(\.\d+)?$/.test(v) || v === "px";

export function readTheme(css: string): ThemeNames {
  const collect = (ns: string) =>
    new Set(
      [...css.matchAll(new RegExp(`--${ns}-([a-z0-9-]+):`, "g"))]
        .map((m) => m[1]!)
        .filter((name) => !name.includes("--") && name !== "*"),
    );
  return { colors: collect("color"), texts: collect("text"), radii: collect("radius") };
}

/** Returns the base utility, or null when the token is not something we check. */
function baseUtility(token: string): string | null {
  if (/[[\]()${}]/.test(token)) return null; // arbitrary values and template holes
  let base = token.slice(token.lastIndexOf(":") + 1);
  base = base.replace(/^!/, "").replace(/!$/, "").replace(/^-/, "");
  const slash = base.indexOf("/");
  if (slash !== -1) base = base.slice(0, slash);
  return base || null;
}

function isKnown(base: string, theme: ThemeNames): boolean {
  const color = (v: string) => theme.colors.has(v) || COLOR_KEYWORDS.has(v);

  const rounded = /^rounded(?:-(.+))?$/.exec(base);
  if (rounded) {
    const rest = rounded[1];
    if (rest === undefined || RADIUS_SIDES.has(rest)) return true;
    const dash = rest.indexOf("-");
    const name = dash !== -1 && RADIUS_SIDES.has(rest.slice(0, dash)) ? rest.slice(dash + 1) : rest;
    return theme.radii.has(name) || RADIUS_WORDS.has(name);
  }

  const m =
    /^(ring-offset|placeholder|outline|divide|border|stroke|ring|fill|text|bg)(?:-(.+))?$/.exec(
      base,
    );
  if (!m) return true;
  const kind = m[1]!;
  const rest = m[2];
  // A bare word like "text" or "fill" is prose, not a utility.
  if (rest === undefined && ["text", "bg", "fill", "stroke", "placeholder"].includes(kind)) {
    return true;
  }

  switch (kind) {
    case "text":
      return rest !== undefined && (color(rest) || theme.texts.has(rest) || TEXT_WORDS.has(rest));
    case "bg":
      return (
        rest !== undefined &&
        (color(rest) || BG_WORDS.has(rest) || BG_PREFIXES.some((p) => rest.startsWith(p)))
      );
    case "border": {
      if (rest === undefined || isWidth(rest) || LINE_STYLES.has(rest) || color(rest)) return true;
      if (["collapse", "separate"].includes(rest) || rest.startsWith("spacing")) return true;
      const dash = rest.indexOf("-");
      const side = dash === -1 ? rest : rest.slice(0, dash);
      if (!BORDER_SIDES.has(side)) return false;
      if (dash === -1) return true;
      const value = rest.slice(dash + 1);
      return isWidth(value) || color(value);
    }
    case "ring":
      return rest === undefined || isWidth(rest) || rest === "inset" || color(rest);
    case "ring-offset":
      return rest !== undefined && (isWidth(rest) || color(rest));
    case "divide":
      return (
        rest === undefined ||
        /^[xy](-\d+|-reverse)?$/.test(rest) ||
        LINE_STYLES.has(rest) ||
        color(rest)
      );
    case "outline":
      return (
        rest === undefined ||
        LINE_STYLES.has(rest) ||
        isWidth(rest) ||
        /^offset-\d+$/.test(rest) ||
        color(rest)
      );
    case "fill":
    case "stroke":
      return rest !== undefined && (rest === "none" || isWidth(rest) || color(rest));
    case "placeholder":
      return rest !== undefined && color(rest);
    default:
      return true;
  }
}

/** Every class-like token inside a string literal of `source` that the theme cannot resolve. */
export function findUnknownClasses(source: string, theme: ThemeNames): string[] {
  const hits: string[] = [];
  for (const literal of source.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) {
    const text = literal[1] ?? literal[2] ?? literal[3] ?? "";
    for (const token of text.split(/\s+/)) {
      if (!/^[!a-z0-9:-][\w:/.!-]*$/.test(token)) continue;
      const base = baseUtility(token);
      if (base && !isKnown(base, theme) && !hits.includes(token)) hits.push(token);
    }
  }
  return hits;
}

function componentFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx") && !f.endsWith(".stories.tsx"))
    .map((f) => path.join(dir, f));
}

function main(): void {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const themeCss = fs.readFileSync(
    path.join(scriptDir, "..", "src", "theme", "tailwind-theme.css"),
    "utf-8",
  );
  const theme = readTheme(themeCss);
  const pkgDir = path.resolve(process.argv[2] ?? ".");

  let failures = 0;
  for (const file of componentFiles(path.join(pkgDir, "src", "components"))) {
    for (const cls of findUnknownClasses(fs.readFileSync(file, "utf-8"), theme)) {
      console.error(`${path.relative(pkgDir, file)}: ${cls}`);
      failures += 1;
    }
  }
  if (failures > 0) {
    console.error(`${failures} class(es) with no theme token.`);
    process.exit(1);
  }
  console.log("Theme classes OK.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
