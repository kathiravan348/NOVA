import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  emptyHandlers,
  errorHandlers,
  handlers,
  mockBrokerAccounts,
  mockBrokerProfiles,
} from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
let patches: string[] = [];
server.events.on("request:start", ({ request }) => {
  if (request.method === "PATCH") patches.push(new URL(request.url).pathname);
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  patches = [];
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const card = (title: string) =>
  screen.getByRole("heading", { name: title }).closest("div.rounded-lg") as HTMLElement;

describe("Broker page", () => {
  it("lists every account with its session status", async () => {
    renderApp("/broker");
    for (const a of mockBrokerAccounts) {
      const links = await screen.findAllByRole("link", { name: a.label });
      expect(links.some((l) => l.getAttribute("href") === `/broker/${a.id}`)).toBe(true);
    }
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Expired").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not logged in").length).toBeGreaterThan(0);
  });

  it("warns about windows above 80% and links to the account", async () => {
    renderApp("/broker");
    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent(/above 80% of the NOVA limit/);
    expect(warning).toHaveTextContent("Secondary Algorithmic Account · Orders · per day: 85%");
    for (const link of within(warning).getAllByRole("link", {
      name: "Secondary Algorithmic Account",
    })) {
      expect(link).toHaveAttribute("href", "/broker/brk_002");
    }
  });

  it("shows the broker facts without any app details (per account since D55)", async () => {
    renderApp("/broker");
    expect(await screen.findByText("Kite Connect v3")).toBeInTheDocument();
    expect(screen.getByText(/valid until 06:00 IST/)).toBeInTheDocument();
    expect(screen.queryByText("API key")).not.toBeInTheDocument();
  });

  it("opens every useful link from the data in a new tab", async () => {
    renderApp("/broker");
    await screen.findByText("Useful links");
    const links = within(card("Useful links")).getAllByRole("link");
    expect(links).toHaveLength(mockBrokerProfiles[0]!.links.length);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("shows empty and error states", async () => {
    server.use(...emptyHandlers);
    renderApp("/broker");
    expect((await screen.findAllByText("No broker accounts")).length).toBeGreaterThan(0);
    expect(await screen.findByText("No broker profile")).toBeInTheDocument();
    cleanup();
    server.resetHandlers();
    server.use(...errorHandlers);
    renderApp("/broker");
    expect(
      (await screen.findAllByRole("button", { name: "Try again" }, { timeout: 4000 })).length,
    ).toBeGreaterThan(0);
  });

  describe("Add account", () => {
    const open = async () => {
      renderApp("/broker");
      fireEvent.click(await screen.findByRole("button", { name: "Add account" }));
      return screen.findByRole("dialog", { name: "Add broker account" });
    };
    const fill = (label: string, clientId: string) => {
      fireEvent.change(screen.getByLabelText("Account name"), { target: { value: label } });
      fireEvent.change(screen.getByLabelText("Zerodha client ID"), { target: { value: clientId } });
      fireEvent.click(screen.getAllByRole("button", { name: "Add account" }).at(-1)!);
    };

    it("offers the button on an empty list too", async () => {
      server.use(...emptyHandlers);
      renderApp("/broker");
      expect((await screen.findAllByText("No broker accounts")).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: "Add account" }).length).toBeGreaterThan(0);
    });

    it("checks the client ID before sending", async () => {
      await open();
      fill("Main", "AB-1");
      expect(await screen.findByText("4–12 letters or digits")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("shows the server message for a duplicate", async () => {
      await open();
      fill("Again", "ab1234");
      expect(await screen.findByRole("alert")).toHaveTextContent("Account AB1234 already exists");
    });

    it("adds the account and closes (demo)", async () => {
      await open();
      fill("Family", "zz9999");
      expect(await screen.findByText("Account added (demo)")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
  });
});

describe("Account page", () => {
  it("shows an active account without a login prompt", async () => {
    renderApp("/broker/brk_001");
    expect(await screen.findByRole("heading", { name: "Primary Trading Account" }));
    expect(screen.getByText("Kite session")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log in to Kite" })).not.toBeInTheDocument();
  });

  it("shows the time left on an active session and the account's limits", async () => {
    renderApp("/broker/brk_001");
    expect(await screen.findByText("18 h 00 m")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "Rate limits" });
    const limits = card("Rate limits");
    expect(within(limits).getByText("120 / 4,000 · 3%")).toBeInTheDocument();
    expect(within(limits).getAllByText("No throttling")).toHaveLength(4);
    expect(within(limits).getAllByText("Per second")).toHaveLength(4);
  });

  it("shows every window with reset time and throttling", async () => {
    renderApp("/broker/brk_002");
    await screen.findByRole("heading", { name: "Rate limits" });
    const limits = card("Rate limits");
    expect(within(limits).getByText("3,400 / 4,000 · 85%")).toBeInTheDocument();
    expect(within(limits).getByText("Throttled 5")).toBeInTheDocument();
    expect(within(limits).getAllByRole("meter").length).toBe(6);
    expect(within(limits).getAllByText(/Resets 22 Sep, 00:00 IST/)).toHaveLength(1);
    expect(within(limits).getAllByText("Rolling window · peak").length).toBe(5);
    expect(within(limits).getAllByText("Above 80%").length).toBeGreaterThan(0);
  });

  it("edits own limits, rejects values above the broker limit and saves (demo)", async () => {
    renderApp("/broker/brk_002");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit Orders limits for Secondary Algorithmic Account",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const minute = within(dialog).getByLabelText(/per minute/);
    expect(minute).toHaveValue("320");
    fireEvent.change(minute, { target: { value: "401" } });
    expect(within(dialog).getByText("At most the broker limit (400)")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save limits" })).toBeDisabled();
    fireEvent.change(minute, { target: { value: "350" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save limits" }));
    expect(await screen.findByText("Limits saved (demo)")).toBeInTheDocument();
    expect(patches).toEqual(["/api/v1/broker/rate-limits/brk_002/orders"]);
  });

  it("prompts login on an expired account", async () => {
    renderApp("/broker/brk_002");
    expect(await screen.findByRole("button", { name: "Log in to Kite" })).toBeInTheDocument();
  });

  it("shows Not found for an unknown account", async () => {
    renderApp("/broker/nope");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });

  it("starts the Kite login in real mode (D48)", async () => {
    vi.stubEnv("VITE_DATA_MODE", "real");
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign });
    renderApp("/broker/brk_002");

    fireEvent.click(await screen.findByRole("button", { name: "Log in to Kite" }));

    expect(assign).toHaveBeenCalledWith("/api/v1/broker/accounts/brk_002/login");
  });

  it("reports the Kite login result once and clears it from the address", async () => {
    const { router } = renderApp("/broker/brk_001?kite=connected");

    expect(await screen.findByText("Kite connected")).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("keeps the Kite result when an old /accounts link redirects", async () => {
    const { router } = renderApp("/accounts/brk_001?kite=connected");

    expect(await screen.findByText("Kite connected")).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/broker/brk_001"));
  });
});

describe("Kite app (D55)", () => {
  const PASSPHRASE = "a long enough passphrase";
  const kiteCard = async () => {
    await screen.findByRole("heading", { name: "Kite app" });
    return card("Kite app");
  };
  const type = (label: string | RegExp, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it("shows the key's last 4, a locked secret and the redirect URL, never the secret", async () => {
    renderApp("/broker/brk_001");
    const app = await kiteCard();
    expect(within(app).getByText("•••• k7Q2")).toBeInTheDocument();
    expect(within(app).getByText("Saved, locked by your passphrase")).toBeInTheDocument();
    expect(
      within(app).getByText("http://localhost:3001/api/v1/broker/kite/callback"),
    ).toBeInTheDocument();
    expect(within(app).getByRole("button", { name: "Test passphrase" })).toBeInTheDocument();
  });

  it("offers setup on an account without keys", async () => {
    renderApp("/broker/brk_003");
    const app = await kiteCard();
    expect(within(app).getByText("Not set")).toBeInTheDocument();
    expect(within(app).getByText("Not saved")).toBeInTheDocument();
    expect(within(app).queryByRole("button", { name: "Test passphrase" })).not.toBeInTheDocument();
  });

  it("sets the keys: blocks a short or mismatched passphrase, then saves (demo)", async () => {
    renderApp("/broker/brk_003");
    fireEvent.click(within(await kiteCard()).getByRole("button", { name: "Set key and secret" }));
    const dialog = await screen.findByRole("dialog", { name: "Set Kite API key and secret" });
    type("API key", "newkeyZX90");
    type("API secret", "s3cret");
    type(/^Passphrase/, "short");
    type("Confirm passphrase", "other");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save keys" }));
    expect(await within(dialog).findByText("At least 12 characters")).toBeInTheDocument();
    expect(within(dialog).getByText("The passphrases do not match")).toBeInTheDocument();

    type(/^Passphrase/, PASSPHRASE);
    type("Confirm passphrase", PASSPHRASE);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save keys" }));
    expect(await screen.findByText("Kite keys saved (demo)")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain(PASSPHRASE);
  });

  it("warns that a new key logs the account out", async () => {
    renderApp("/broker/brk_001");
    fireEvent.click(within(await kiteCard()).getByRole("button", { name: "Set key and secret" }));
    expect(
      await screen.findByText("Saving a new key logs this account out of Kite."),
    ).toBeInTheDocument();
  });

  it("edits the details and checks the static IP", async () => {
    renderApp("/broker/brk_001");
    fireEvent.click(within(await kiteCard()).getByRole("button", { name: "Edit details" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Kite app details" });
    type("Static IP", "1.2.3");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save details" }));
    expect(await within(dialog).findByText(/An IPv4 address/)).toBeInTheDocument();
    type("Static IP", "203.0.113.9");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save details" }));
    expect(await screen.findByText("Details saved (demo)")).toBeInTheDocument();
  });

  it("tests the passphrase: wrong stays open, right closes", async () => {
    renderApp("/broker/brk_001");
    fireEvent.click(within(await kiteCard()).getByRole("button", { name: "Test passphrase" }));
    const dialog = await screen.findByRole("dialog", { name: "Test passphrase" });
    type("Passphrase", "wrong");
    fireEvent.click(within(dialog).getByRole("button", { name: "Test passphrase" }));
    expect(await within(dialog).findByText("Wrong passphrase")).toBeInTheDocument();
    expect(screen.getByLabelText("Passphrase")).toHaveValue("");
    type("Passphrase", PASSPHRASE);
    fireEvent.click(within(dialog).getByRole("button", { name: "Test passphrase" }));
    expect(await screen.findByText("Passphrase is correct")).toBeInTheDocument();
  });

  it("finishes the login from ?kite=finish: wrong, then right passphrase", async () => {
    const { router } = renderApp("/broker/brk_002?kite=finish");
    const dialog = await screen.findByRole("dialog", { name: "Finish Kite login" });
    type("Passphrase", "wrong");
    fireEvent.click(within(dialog).getByRole("button", { name: "Finish login" }));
    expect(await within(dialog).findByText("Wrong passphrase")).toBeInTheDocument();
    type("Passphrase", PASSPHRASE);
    fireEvent.click(within(dialog).getByRole("button", { name: "Finish login" }));
    expect(await screen.findByText("Kite connected")).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with a message when the pending login expired", async () => {
    const { router } = renderApp("/broker/brk_002?kite=finish");
    const dialog = await screen.findByRole("dialog", { name: "Finish Kite login" });
    type("Passphrase", "expired");
    fireEvent.click(within(dialog).getByRole("button", { name: "Finish login" }));
    expect(await screen.findByText("Kite login failed")).toBeInTheDocument();
    expect(screen.getByText("Login expired: log in to Kite again")).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("the login prompt points to setup when the account has no keys", async () => {
    server.use(
      http.get("*/api/v1/broker/accounts/brk_002/kite-app", () =>
        HttpResponse.json({
          accountId: "brk_002",
          apiKeyLast4: null,
          secretSaved: false,
          plan: null,
          subscriptionRenewsOn: null,
          redirectUrl: "http://localhost:3001/api/v1/broker/kite/callback",
          postbackUrl: null,
          staticIp: null,
          updatedAt: null,
        }),
      ),
    );
    renderApp("/broker/brk_002");
    const setup = await screen.findByRole("link", { name: "Set up the Kite app" });
    expect(setup).toHaveAttribute("href", "/broker/brk_002");
    expect(screen.queryByRole("button", { name: "Log in to Kite" })).not.toBeInTheDocument();
  });
});
