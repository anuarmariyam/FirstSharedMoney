import { createClient, type Session } from "@supabase/supabase-js";
import { parsePublicBackendConfig } from "../lib/backend-config";
import { SessionServiceError } from "./session-error";

export const backendConfig = parsePublicBackendConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
export const supabase = backendConfig
  ? createClient(backendConfig.url, backendConfig.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: backendConfig.storageKey,
      },
    })
  : null;
let signIn: Promise<Session> | null = null;

export async function existingBrowserSession(): Promise<Session> {
  if (!supabase)
    throw new SessionServiceError(
      "NOT_CONNECTED",
      "Live sessions are not connected yet.",
    );
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session)
    throw new SessionServiceError(
      "UNAUTHENTICATED",
      "This browser has no usable session. Reopen your original invitation or create a new plan.",
    );
  return data.session;
}
/** Never replace an existing identity to join another partner's invitation. */
export function ensureAnonymousSession(): Promise<Session> {
  if (!supabase || !backendConfig)
    return Promise.reject(
      new SessionServiceError(
        "NOT_CONNECTED",
        "Live sessions are not connected yet.",
      ),
    );
  if (signIn) return signIn;
  const client = supabase;
  const lockName = `${backendConfig.storageKey}-initial-sign-in`;
  const establish = async () => {
    const current = await client.auth.getSession();
    if (current.error)
      throw new SessionServiceError(
        "UNAUTHENTICATED",
        "Your stored browser session could not be restored. Do not clear it unless you accept losing access.",
      );
    if (current.data.session) return current.data.session;
    try {
      localStorage.setItem("fsm-storage-check", "1");
      localStorage.removeItem("fsm-storage-check");
    } catch {
      throw new SessionServiceError(
        "STORAGE_UNAVAILABLE",
        "Allow browser storage before creating an anonymous session.",
      );
    }
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.session)
      throw new SessionServiceError(
        "AUTH_FAILED",
        "Anonymous sign-in could not be completed. Check the Supabase anonymous sign-in settings, CAPTCHA requirements, and rate limits.",
      );
    return data.session;
  };
  const restoreOnly = async () => {
    const current = await client.auth.getSession();
    if (!current.error && current.data.session) return current.data.session;
    throw new SessionServiceError(
      "BROWSER_UNSUPPORTED",
      "Use a current browser with Web Locks support to safely create an anonymous session.",
    );
  };
  signIn = (
    navigator.locks
      ? navigator.locks.request(lockName, establish)
      : restoreOnly()
  ).finally(() => {
    signIn = null;
  });
  return signIn;
}
