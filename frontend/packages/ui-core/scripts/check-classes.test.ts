import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findUnknownClasses, readTheme } from "./check-classes";

const here = path.dirname(fileURLToPath(import.meta.url));
const theme = readTheme(
  fs.readFileSync(path.join(here, "..", "src", "theme", "tailwind-theme.css"), "utf-8"),
);

const check = (classes: string) => findUnknownClasses(`<div className="${classes}" />`, theme);

describe("check-classes", () => {
  it("reads colour, text and radius names from the theme", () => {
    expect(theme.colors.has("bg-raised")).toBe(true);
    expect(theme.texts.has("body-sm")).toBe(true);
    expect(theme.texts.has("body-sm--line-height")).toBe(false);
    expect(theme.radii.size).toBeGreaterThan(0);
  });

  it("accepts known-good classes", () => {
    expect(
      check(
        [
          "focus-visible:ring-offset-bg-ground",
          "border-t-transparent",
          "text-body-sm",
          "text-right",
          "hover:bg-bg-raised/50",
          "border",
          "border-2",
          "ring-2",
          "border-t",
          "outline-none",
          "outline-hidden",
          "rounded-md",
          "rounded-full",
          "rounded-t-md",
          "text-[13px]",
          "bg-(--action)",
          "fill-current",
          "border-dashed",
          "text-on-action",
        ].join(" "),
      ),
    ).toEqual([]);
  });

  it("reports classes with no theme token", () => {
    expect(check("ring-focus-ring text-title rounded-xl bg-blue-500 p-4")).toEqual([
      "ring-focus-ring",
      "text-title",
      "rounded-xl",
      "bg-blue-500",
    ]);
  });

  it("checks cva and cn strings, not just className", () => {
    const source = `const v = cva("inline-flex", { variants: { tone: { x: "hover:text-danger" } } });`;
    expect(findUnknownClasses(source, theme)).toEqual(["hover:text-danger"]);
  });

  it("treats a literal that is exactly a colour name as a token key", () => {
    const source = `const vars = ["text-muted", "bg-surface"]; colors["border-default"];`;
    expect(findUnknownClasses(source, theme)).toEqual([]);
    expect(findUnknownClasses(`cn("p-2 text-muted")`, theme)).toEqual(["text-muted"]);
  });

  it("ignores plain prose and imports", () => {
    expect(
      findUnknownClasses(`import x from "react"; const t = "Border and text colours";`, theme),
    ).toEqual([]);
  });
});
