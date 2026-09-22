import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { novaAliases } from "../../vite.aliases";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: novaAliases,
  },
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
