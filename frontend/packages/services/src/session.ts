import { useSyncExternalStore } from "react";
import { LoginRequestSchema, UserSchema } from "@nova/contracts";
import { getMe } from "./api/orbit";
import { getDataMode } from "./config";
import { ApiRequestError, apiPost, apiSend, onUnauthorized } from "./http";

/**
 * Who is signed in, for the UI. Mock mode (D23): any credentials. Real mode (D48): NOVA Core's HttpOnly
 * cookie is the real session; this hint is cleared on sign-out and on any 401.
 */
export interface Session {
  userId: string;
  displayName: string;
}

const STORAGE_KEY = "nova-session";
const listeners = new Set<() => void>();

function notify(): void {
  cachedRaw = undefined;
  for (const listener of listeners) listener();
}

let cachedRaw: string | null | undefined;
let cachedSession: Session | null = null;

function readRaw(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedSession;
  cachedRaw = raw;
  cachedSession = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Session>;
      if (typeof parsed.userId === "string" && typeof parsed.displayName === "string") {
        cachedSession = { userId: parsed.userId, displayName: parsed.displayName };
      }
    } catch {
      // corrupt value: treat as signed out
    }
  }
  return cachedSession;
}

function store(session: Session): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // storage unavailable: session lasts until reload
  }
  notify();
}

function clear(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notify();
}

onUnauthorized(() => {
  if (getSession()) clear();
});

/** `identifier` is an email address in real mode and any name in mock mode. */
export async function signIn(identifier: string, password: string): Promise<Session> {
  if (!identifier.trim() || !password.trim()) {
    throw new ApiRequestError(401, "unauthorized", "Enter your sign-in details and password.");
  }
  if (getDataMode() === "real") {
    const body = LoginRequestSchema.safeParse({ email: identifier.trim(), password });
    if (!body.success) {
      throw new ApiRequestError(400, "invalid_request", "Enter a valid email address.");
    }
    const user = await apiPost("/auth/login", body.data, UserSchema);
    const session: Session = { userId: user.id, displayName: user.name };
    store(session);
    return session;
  }
  const me = await getMe();
  const session: Session = { userId: me.id, displayName: me.name };
  store(session);
  return session;
}

/** Signs out locally even if the server call fails (the cookie then simply expires). */
export async function signOut(): Promise<void> {
  if (getDataMode() === "real") {
    try {
      await apiSend("POST", "/auth/logout", {});
    } catch {
      // already signed out on the server, or offline
    }
  }
  clear();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, () => null);
}
