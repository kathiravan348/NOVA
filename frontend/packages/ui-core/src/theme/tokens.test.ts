import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("tokens.css", () => {
  const packageDir = path.resolve(__dirname, "..", "..");
  const tokensJsonPath = path.join(packageDir, "src", "theme", "tokens.json");
  const tokensCssPath = path.join(packageDir, "src", "theme", "tokens.css");

  const tokens = JSON.parse(fs.readFileSync(tokensJsonPath, "utf-8"));
  const css = fs.readFileSync(tokensCssPath, "utf-8");

  // Extract blocks from CSS
  const darkBlockMatch = css.match(/:root,\s*\[data-theme="dark"\]\s*\{([^}]+)\}/);
  const lightBlockMatch = css.match(/\[data-theme="light"\]\s*\{([^}]+)\}/);
  const rootBlockMatch = css.match(/:root\s*\{([^}]+)\}/);

  it("contains both dark and light theme blocks", () => {
    expect(darkBlockMatch).toBeTruthy();
    expect(lightBlockMatch).toBeTruthy();
    expect(rootBlockMatch).toBeTruthy();
  });

  const darkBlock = darkBlockMatch ? darkBlockMatch[1] : "";
  const lightBlock = lightBlockMatch ? lightBlockMatch[1] : "";
  const rootBlock = rootBlockMatch ? rootBlockMatch[1] : "";

  it("includes every colour token in the dark theme block with correct value", () => {
    for (const token of tokens.color.tokens) {
      const expectedDeclaration = `--${token.name}: ${token.value.dark};`;
      expect(darkBlock).toContain(expectedDeclaration);
    }
  });

  it("includes every colour token in the light theme block with correct value", () => {
    for (const token of tokens.color.tokens) {
      const expectedDeclaration = `--${token.name}: ${token.value.light};`;
      expect(lightBlock).toContain(expectedDeclaration);
    }
  });

  it("includes fonts, spacing, radius, and size tokens in :root", () => {
    expect(rootBlock).toContain(`--font-sans: ${tokens.type.families.sans};`);
    expect(rootBlock).toContain(`--font-mono: ${tokens.type.families.mono};`);

    for (const token of tokens.spacing.tokens) {
      expect(rootBlock).toContain(`--${token.name}: ${token.value};`);
    }

    for (const token of tokens.radius.tokens) {
      expect(rootBlock).toContain(`--${token.name}: ${token.value};`);
    }

    for (const token of tokens.size.tokens) {
      expect(rootBlock).toContain(`--${token.name}: ${token.value};`);
    }
  });
});
