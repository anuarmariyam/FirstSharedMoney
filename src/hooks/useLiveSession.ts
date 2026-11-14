import { useEffect, useReducer, useState } from "react";
import { useBrowserAuth } from "./useBrowserAuth";
import { backendConfig } from "../services/supabase";
import { fsmClient } from "../services/fsm-client";
import {
  sessionError,
  type SessionServiceError,
} from "../services/session-error";
import type { CoupleSession } from "../types/domain";

export type LiveSessionState =
  | { kind: "demo" | "not_configured" | "loading" | "signed_out" }
  | { kind: "error"; error: SessionServiceError }
  | { kind: "ready"; session: CoupleSession };
export function useLiveSession(coupleId: string | undefined) {
  const auth = useBrowserAuth();
  const [revision, reload] = useReducer((value) => value + 1, 0);
  const key = `${coupleId}/${auth.userId}`;
  const [result, setResult] = useState<{
    key: string;
    state: LiveSessionState;
  } | null>(null);
  useEffect(() => {
    if (
      !backendConfig ||
      !coupleId ||
      coupleId === "demo" ||
      auth.restoring ||
      !auth.userId
    )
      return;
    const controller = new AbortController();
    void fsmClient
      .request("getSession", null, { coupleId }, { signal: controller.signal })
      .then((session) => {
        if (!controller.signal.aborted) {
          setResult({ key, state: { kind: "ready", session } });
          // A locator only: no tokens, answers, or invitation capabilities.
          try {
            localStorage.setItem(`fsm-last-session:${auth.userId}`, session.id);
          } catch {
            /* Navigation still works without this optional locator. */
          }
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            state: { kind: "error", error: sessionError(error) },
          });
      });
    return () => controller.abort();
  }, [coupleId, auth.userId, auth.restoring, key, revision]);
  useEffect(() => {
    if (!backendConfig || coupleId === "demo" || !auth.userId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 5000);
    const focus = () => reload();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [coupleId, auth.userId]);
  let state: LiveSessionState;
  if (coupleId === "demo") state = { kind: "demo" };
  else if (!backendConfig) state = { kind: "not_configured" };
  else if (auth.restoring) state = { kind: "loading" };
  else if (!auth.userId) state = { kind: "signed_out" };
  else state = result?.key === key ? result.state : { kind: "loading" };
  return { state, reload };
}
