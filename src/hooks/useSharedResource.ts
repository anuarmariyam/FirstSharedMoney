import { useEffect, useReducer, useState } from "react";
import { useBrowserAuth } from "./useBrowserAuth";
import { fsmClient } from "../services/fsm-client";
import {
  sessionError,
  type SessionServiceError,
} from "../services/session-error";
import type { FsmApiContract } from "../types/api";

export function useSharedResource<
  Op extends "getComparison" | "getFinancialInputs",
>(operation: Op, coupleId: string) {
  const auth = useBrowserAuth();
  const [revision, reload] = useReducer((n) => n + 1, 0);
  const key = `${operation}/${coupleId}/${auth.userId}`;
  const [result, setResult] = useState<{
    key: string;
    data: FsmApiContract[Op]["response"] | null;
    error: SessionServiceError | null;
  } | null>(null);
  useEffect(() => {
    if (!auth.userId || auth.restoring) return;
    let active = true,
      inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function load() {
      if (inFlight || !active) return;
      inFlight = true;
      try {
        const data = await fsmClient.request(
          operation,
          null,
          { coupleId },
          { signal: controller.signal },
        );
        if (active) setResult({ key, data, error: null });
      } catch (error) {
        if (active) setResult({ key, data: null, error: sessionError(error) });
      } finally {
        inFlight = false;
        if (active) timer = setTimeout(() => void load(), 5000);
      }
    }
    const focus = () => {
      clearTimeout(timer);
      void load();
    };
    void load();
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
      window.removeEventListener("focus", focus);
    };
  }, [operation, coupleId, auth.userId, auth.restoring, key, revision]);
  return {
    data: result?.key === key ? result.data : null,
    error: result?.key === key ? result.error : null,
    loading: !result || result.key !== key,
    reload,
  };
}
