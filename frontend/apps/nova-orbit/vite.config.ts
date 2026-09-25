import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { novaAliases } from "../../vite.aliases";

/**
 * `vite --mode real` (D48): the app calls NOVA Core through this dev server, so the browser stays
 * same-origin and the HttpOnly session cookie works. `NOVA_API_URL` overrides the Core address.
 */
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: novaAliases,
  },
  define: mode === "real" ? { "import.meta.env.VITE_DATA_MODE": JSON.stringify("real") } : {},
  server: {
    port: 3000,
    proxy:
      mode === "real"
        ? { "/api": { target: process.env["NOVA_API_URL"] ?? "http://127.0.0.1:8000" } }
        : undefined,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
}));
