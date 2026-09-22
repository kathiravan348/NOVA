import { useSyncExternalStore } from "react";
import { getMe } from "./api/orbit";
import { getApiBaseUrl } from "./config";
import { ApiRequestError } from "./http";

/** Stage A mock session (D23). Stage B replaces this with NOVA Core auth. */
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

export async function signIn(username: string, password: string): Promise<Session> {
  getApiBaseUrl(); // throws in real mode (Stage A)
  if (!username.trim() || !password.trim()) {
    throw new ApiRequestError(401, "unauthorized", "Enter a username and password.");
  }
  const me = await getMe();
  const session: Session = { userId: me.id, displayName: me.name };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // storage unavailable: session lasts until reload
  }
  notify();
  return session;
}

export function signOut(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, () => null);
}
