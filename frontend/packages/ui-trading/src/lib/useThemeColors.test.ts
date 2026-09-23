import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useThemeColors } from "./useThemeColors";

const root = document.documentElement;

function setTheme(theme: "dark" | "light", profit: string) {
  root.style.setProperty("--profit", profit);
  root.dataset["theme"] = theme;
}

afterEach(() => {
  root.removeAttribute("style");
  delete root.dataset["theme"];
});

describe("useThemeColors", () => {
  it("reads CSS variables from <html>", () => {
    setTheme("dark", "#00ff00");
    const { result } = renderHook(() => useThemeColors(["profit", "missing"]));
    expect(result.current["profit"]).toBe("#00ff00");
    expect(result.current["missing"]).toBe("");
  });

  it("re-reads when data-theme changes", async () => {
    setTheme("dark", "#00ff00");
    const { result } = renderHook(() => useThemeColors(["profit"]));
    act(() => setTheme("light", "#008800"));
    await waitFor(() => expect(result.current["profit"]).toBe("#008800"));
  });
});
