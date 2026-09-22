import type { Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import { applyTheme, type ThemeName } from "@nova/ui-core";
import "./preview.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        title: "Theme",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals["theme"] ?? "dark") as ThemeName;
      useEffect(() => {
        applyTheme(theme);
      }, [theme]);

      return <Story />;
    },
  ],
  parameters: {
    layout: "padded",
    viewport: {
      options: {
        mobile: {
          name: "Mobile",
          styles: {
            width: "360px",
            height: "800px",
          },
          type: "mobile",
        },
        tablet: {
          name: "Tablet",
          styles: {
            width: "768px",
            height: "1024px",
          },
          type: "tablet",
        },
        desktop: {
          name: "Desktop",
          styles: {
            width: "1440px",
            height: "900px",
          },
          type: "desktop",
        },
      },
    },
    backgrounds: {
      disable: true,
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;
