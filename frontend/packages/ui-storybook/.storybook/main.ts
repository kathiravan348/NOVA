
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { novaAliases } from "../../../vite.aliases.ts";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: [
    "../src/**/*.stories.tsx",
    "../../ui-core/src/**/*.stories.tsx",
    "../../ui-trading/src/**/*.stories.tsx",
  ],
  addons: ["@storybook/addon-a11y"],
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [tailwindcss()],
      resolve: {
        alias: novaAliases,
      },
    });
  },
};

export default config;
