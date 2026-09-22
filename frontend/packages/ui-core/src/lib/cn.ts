import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const customTwMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display",
        "page-title",
        "section-title",
        "card-title",
        "body",
        "body-sm",
        "label",
        "number-lg",
        "number",
        "number-sm",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return customTwMerge(clsx(inputs));
}
