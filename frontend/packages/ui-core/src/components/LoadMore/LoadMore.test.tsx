import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadMore } from "./LoadMore";

type Callback = (entries: { isIntersecting: boolean }[]) => void;

function stubObserver() {
  const observers: { callback: Callback; disconnect: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(callback: Callback) {
        observers.push({ callback, disconnect: this.disconnect });
      }
    },
  );
  return observers;
}

afterEach(() => vi.unstubAllGlobals());

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

  it("with auto, loads when scrolled into view and not while loading", () => {
    const observers = stubObserver();
    const onLoadMore = vi.fn();
    const { rerender } = render(<LoadMore hasMore auto onLoadMore={onLoadMore} />);
    expect(observers).toHaveLength(1);
    observers[0]!.callback([{ isIntersecting: false }]);
    expect(onLoadMore).not.toHaveBeenCalled();
    observers[0]!.callback([{ isIntersecting: true }]);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    rerender(<LoadMore hasMore auto loading onLoadMore={onLoadMore} />);
    expect(observers[0]!.disconnect).toHaveBeenCalled();
    expect(observers).toHaveLength(1);
  });

  it("without auto, never observes", () => {
    const observers = stubObserver();
    render(<LoadMore hasMore onLoadMore={() => {}} />);
    expect(observers).toHaveLength(0);
  });
});
