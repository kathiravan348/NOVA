import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("submits the typed credentials", () => {
    const onSubmit = vi.fn();
    render(<LoginForm title="Sign in" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: "asha" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSubmit).toHaveBeenCalledWith({ username: "asha", password: "pw" });
  });

  it("shows the error as an alert", () => {
    render(<LoginForm title="Sign in" error="Bad credentials" onSubmit={() => undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Bad credentials");
  });

  it("disables the button while submitting", () => {
    render(<LoginForm title="Sign in" submitting onSubmit={() => undefined} />);
    expect(screen.getByRole("button", { name: /Signing in/ })).toBeDisabled();
  });

  it("renders title, subtitle and hint", () => {
    render(
      <LoginForm title="Orbit" subtitle="Sub" hint="Any password" onSubmit={() => undefined} />,
    );
    expect(screen.getByRole("heading", { name: "Orbit" })).toBeInTheDocument();
    expect(screen.getByText("Sub")).toBeInTheDocument();
    expect(screen.getByText("Any password")).toBeInTheDocument();
  });

  it("can ask for an email instead of a username", () => {
    render(
      <LoginForm
        title="Sign in"
        identifierLabel="Email"
        identifierType="email"
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByLabelText(/Email/)).toHaveAttribute("type", "email");
  });
});
