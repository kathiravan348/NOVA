import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps both text-body and text-text-primary", () => {
    const result = cn("text-body", "text-text-primary");
    expect(result).toBe("text-body text-text-primary");
  });

  it("resolves px-2 px-4 to px-4", () => {
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });

  it("handles conditional classes and falsy values", () => {
    const isFalse = false;
    const isTrue = true;
    expect(cn("base-class", isFalse && "extra", isTrue && "active")).toBe("base-class active");
  });
});
