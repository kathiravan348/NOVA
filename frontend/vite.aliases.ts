import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));

const packageEntry = (name: string): string =>
  path.join(frontendDir, "packages", name, "src", "index.ts");

/** `@nova/*` aliases for Vite; keep in sync with `paths` in tsconfig.base.json. */
export const novaAliases: Record<string, string> = {
  "@nova/brand": path.join(frontendDir, "..", "brand.config.ts"),
  "@nova/ui-core/styles.css": path.join(
    frontendDir,
    "packages",
    "ui-core",
    "src",
    "theme",
    "styles.css",
  ),
  "@nova/ui-core": packageEntry("ui-core"),
  "@nova/ui-trading": packageEntry("ui-trading"),
  "@nova/contracts": packageEntry("contracts"),
  "@nova/services": packageEntry("services"),
  "@nova/mocks": packageEntry("mocks"),
};
