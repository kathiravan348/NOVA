import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { novaAliases } from "../../vite.aliases";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: novaAliases,
  },
  server: {
    port: 3001,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
