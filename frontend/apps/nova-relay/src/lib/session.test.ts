import { describe, expect, it } from "vitest";
import { mockBrokerAccounts } from "@nova/mocks";
import { formatIstShort } from "./format";
import { needsLogin, sessionLabel, sessionTone, timeLeft } from "./session";

describe("session helpers", () => {
  it("labels and tones every status", () => {
    expect(sessionLabel.not_logged_in).toBe("Not logged in");
    expect(sessionTone.active).toBe("success");
    expect(sessionTone.expired).toBe("warning");
  });

  it("needs login only for enabled accounts without an active session", () => {
    const byId = Object.fromEntries(mockBrokerAccounts.map((a) => [a.id, needsLogin(a)]));
    expect(byId).toEqual({ brk_001: false, brk_002: true, brk_003: false });
  });

  it("formats the time left on a session", () => {
    const now = new Date("2026-09-21T06:30:00Z");
    expect(timeLeft("2026-09-22T00:30:00Z", now)).toBe("18 h 00 m");
    expect(timeLeft("2026-09-21T07:12:00Z", now)).toBe("42 m");
    expect(timeLeft("2026-09-21T06:30:00Z", now)).toBeNull();
  });

  it("formats IST times", () => {
    expect(formatIstShort("2026-09-21T18:30:00Z")).toBe("22 Sep, 00:00");
  });
});
