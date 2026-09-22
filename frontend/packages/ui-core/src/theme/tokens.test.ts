import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface NameValue {
  name: string;
  value: string;
}

interface TokensJson {
  color: { tokens: { name: string; value: { dark: string; light: string } }[] };
  type: { families: { sans: string; mono: string } };
  spacing: { tokens: NameValue[] };
  radius: { tokens: NameValue[] };
  size: { tokens: NameValue[] };
}

describe("tokens.css", () => {
  const packageDir = path.resolve(__dirname, "..", "..");
  const tokensJsonPath = path.join(packageDir, "src", "theme", "tokens.json");
  const tokensCssPath = path.join(packageDir, "src", "theme", "tokens.css");

  const tokens = JSON.parse(fs.readFileSync(tokensJsonPath, "utf-8")) as TokensJson;
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

  describe("WCAG contrast", () => {
    function hexToRgb(hex: string): [number, number, number] {
      const cleanHex = hex.replace("#", "");
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      return [r, g, b];
    }

    function relativeLuminance(hex: string): number {
      const [r, g, b] = hexToRgb(hex).map((val) => {
        const s = val / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }) as [number, number, number];

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contrastRatio(hex1: string, hex2: string): number {
      const l1 = relativeLuminance(hex1);
      const l2 = relativeLuminance(hex2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    it("maintains at least 4.5:1 contrast ratio between on-action and action in both dark and light themes", () => {
      const actionToken = tokens.color.tokens.find((t) => t.name === "action");
      const onActionToken = tokens.color.tokens.find((t) => t.name === "on-action");

      expect(actionToken).toBeDefined();
      expect(onActionToken).toBeDefined();

      const darkContrast = contrastRatio(onActionToken!.value.dark, actionToken!.value.dark);
      const lightContrast = contrastRatio(onActionToken!.value.light, actionToken!.value.light);

      expect(darkContrast).toBeGreaterThanOrEqual(4.5);
      expect(lightContrast).toBeGreaterThanOrEqual(4.5);
    });
  });
});
