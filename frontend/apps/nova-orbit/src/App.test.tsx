import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { brand } from "@nova/brand";
import { App } from "./App";

describe("NOVA Orbit smoke test", () => {
  it("starts on the login screen with the product name", async () => {
    render(<App />);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toBe(brand.products.orbit.name);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
