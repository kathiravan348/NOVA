// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, getStoredTheme } from "./theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset["theme"];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getStoredTheme", () => {
    it("returns 'dark' by default when no theme is stored", () => {
      expect(getStoredTheme()).toBe("dark");
    });

    it("returns stored 'light' theme", () => {
      localStorage.setItem("nova-theme", "light");
      expect(getStoredTheme()).toBe("light");
    });

    it("returns stored 'dark' theme", () => {
      localStorage.setItem("nova-theme", "dark");
      expect(getStoredTheme()).toBe("dark");
    });

    it("returns 'dark' when stored value is invalid", () => {
      localStorage.setItem("nova-theme", "solarized");
      expect(getStoredTheme()).toBe("dark");
    });

    it("returns 'dark' when localStorage throws an error", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("Access denied");
      });
      expect(getStoredTheme()).toBe("dark");
    });
  });

  describe("applyTheme", () => {
    it("sets data-theme attribute on documentElement and updates localStorage", () => {
      applyTheme("light");
      expect(document.documentElement.dataset["theme"]).toBe("light");
      expect(localStorage.getItem("nova-theme")).toBe("light");

      applyTheme("dark");
      expect(document.documentElement.dataset["theme"]).toBe("dark");
      expect(localStorage.getItem("nova-theme")).toBe("dark");
    });

    it("sets data-theme even if localStorage throws an error", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Quota exceeded");
      });
      applyTheme("light");
      expect(document.documentElement.dataset["theme"]).toBe("light");
    });
  });
});
