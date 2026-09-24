import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoadMore } from "./LoadMore";

describe("LoadMore", () => {
  it("calls onLoadMore when clicked", () => {
    const onLoadMore = vi.fn();
    render(<LoadMore hasMore onLoadMore={onLoadMore} />);

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("is disabled and says so while loading", () => {
    render(<LoadMore hasMore loading onLoadMore={() => {}} />);

    const button = screen.getByRole("button", { name: "Loading…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("renders nothing when there is nothing more", () => {
    const { container } = render(<LoadMore hasMore={false} onLoadMore={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });
});
