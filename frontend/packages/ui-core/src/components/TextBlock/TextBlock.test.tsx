import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TextBlock } from "./TextBlock";

afterEach(cleanup);
describe("TextBlock", () => {
  it("renders full content as plain text with a keyboard scroll target", () => {
    const text = '<script>alert("hello")</script>\n' + "x".repeat(2000);
    render(<TextBlock label="Response" text={text} />);
    const block = screen.getByLabelText("Response");
    expect(block).toHaveValue(text);
    expect(block).toHaveAttribute("readonly");
    expect(block.querySelector("script")).toBeNull();
  });
  it("renders an empty state", () => {
    render(<TextBlock label="Request" text="" />);
    expect(screen.getByText("No content")).toBeInTheDocument();
  });
});
