import { useCallback, useEffect, useRef, useState } from "react";
import { fsmClient } from "../services/fsm-client";
import { sessionError } from "../services/session-error";
import { questions } from "../features/questionnaire/catalog";
import {
  questionnaireDraft,
  toAnswerValue,
} from "../features/questionnaire/answer-adapter";
import {
  validateAnswer,
  type DraftAnswers,
  type DraftValue,
} from "../features/questionnaire/validation";
import type {
  CoupleId,
  PartnerId,
  PrivacyConsent,
  QuestionCode,
  Questionnaire,
} from "../types/domain";
import type { SaveAnswerRequest } from "../types/api";

export function useQuestionnaire(coupleId: CoupleId, partnerId: PartnerId) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(
    null,
  );
  const [draft, setDraft] = useState<DraftAnswers>({});
  const [consent, setConsent] = useState<PrivacyConsent>({
    comparison: false,
    budget: false,
  });
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const current = useRef<Questionnaire | null>(null);
  const edits = useRef(new Map<QuestionCode, DraftValue>());
  const active = useRef(false);
  const blocked = useRef(false);
  const saving = useRef<Promise<boolean> | null>(null);
  const operation = useRef(false);
  const loadSequence = useRef(0);
  const accept = useCallback(
    (value: Questionnaire) => {
      if (
        value.partnerId !== partnerId ||
        value.answers.some((answer) => answer.coupleId !== coupleId)
      )
        throw new Error("INVALID_RESPONSE");
      current.current = value;
      if (active.current) setQuestionnaire(value);
    },
    [coupleId, partnerId],
  );
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    await Promise.resolve();
    if (!active.current || sequence !== loadSequence.current) return;
    setLoading(true);
    setError("");
    try {
      const value = await fsmClient.request("getQuestionnaire", null, {
        coupleId,
      });
      if (!active.current || sequence !== loadSequence.current) return;
      accept(value);
      edits.current.clear();
      blocked.current = false;
      setDraft(questionnaireDraft(value));
      setConsent(value.consent);
      setDirty(false);
      setConflict(false);
    } catch (error) {
      if (active.current && sequence === loadSequence.current)
        setError(sessionError(error).message);
    } finally {
      if (active.current && sequence === loadSequence.current)
        setLoading(false);
    }
  }, [accept, coupleId]);
  const cancelLoad = useCallback(() => {
    active.current = false;
    loadSequence.current++;
  }, []);
  useEffect(() => {
    active.current = true;
    void Promise.resolve().then(load);
    return cancelLoad;
  }, [load, cancelLoad]);
  const fail = useCallback(
    async (error: unknown) => {
      if (!active.current) return;
      const failure = sessionError(error);
      setError(failure.message);
      if (
        failure.code === "STALE_REVISION" ||
        failure.code === "INVALID_STATE"
      ) {
        blocked.current = true;
        setConflict(true);
        try {
          const fresh = await fsmClient.request("getQuestionnaire", null, {
            coupleId,
          });
          if (active.current) accept(fresh);
        } catch {
          /* Preserve unsaved input and show the original error. */
        }
      }
    },
    [accept, coupleId],
  );
  const flush = useCallback((): Promise<boolean> => {
    if (saving.current) return saving.current;
    if (blocked.current || !current.current || operation.current)
      return Promise.resolve(false);
    saving.current = (async () => {
      // Assign the in-flight promise before even an empty queue can finish.
      await Promise.resolve();
      setBusy(true);
      setError("");
      try {
        while (active.current) {
          const entry = [...edits.current].find(
            ([code, value]) =>
              !validateAnswer(
                questions.find((q) => q.code === code)!,
                value,
              ),
          );
          if (!entry) break;
          const [code, value] = entry;
          const q = questions.find((q) => q.code === code)!;
          if (validateAnswer(q, value)) continue;
          const savedValue = JSON.stringify(value);
          const body = {
            questionCode: code,
            value: toAnswerValue(q, value),
            expectedRevision: current.current!.revision,
          } as SaveAnswerRequest;
          const result = await fsmClient.request("saveAnswer", body, {
            coupleId,
          });
          if (!active.current) return false;
          accept(result);
          if (JSON.stringify(edits.current.get(code)) === savedValue)
            edits.current.delete(code);
        }
        return true;
      } catch (error) {
        await fail(error);
        return false;
      } finally {
        saving.current = null;
        if (active.current) {
          setBusy(false);
          setDirty(edits.current.size !== 0);
        }
      }
    })();
    return saving.current;
  }, [accept, coupleId, fail]);
  useEffect(() => {
    if (!dirty || conflict || questionnaire?.status !== "draft") return;
    const timer = setTimeout(() => {
      void flush();
    }, 600);
    return () => clearTimeout(timer);
  }, [draft, dirty, conflict, questionnaire?.status, flush]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (edits.current.size || operation.current || saving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function updateAnswer(code: QuestionCode, value: DraftValue) {
    if (current.current?.status !== "draft" || operation.current) return;
    edits.current.set(code, value);
    setDirty(true);
    setDraft((old) => ({ ...old, [code]: value }));
  }
  async function mutate(
    kind: "submitQuestionnaire" | "reopenQuestionnaire" | "updatePrivacy",
  ) {
    if (operation.current || blocked.current || !current.current) return false;
    if (
      kind === "submitQuestionnaire" &&
      (!(await flush()) || edits.current.size > 0)
    )
      return false;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      const result =
        kind === "reopenQuestionnaire"
          ? await fsmClient.request(
              kind,
              { expectedRevision: current.current.revision },
              { coupleId },
            )
          : await fsmClient.request(
              kind,
              { expectedRevision: current.current.revision, consent },
              { coupleId },
            );
      if (!active.current) return false;
      accept(result);
      setDraft(questionnaireDraft(result));
      setConsent(result.consent);
      edits.current.clear();
      setDirty(false);
      return true;
    } catch (error) {
      await fail(error);
      return false;
    } finally {
      operation.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function reviewConflict(keepLocal: boolean) {
    setBusy(true);
    try {
      const fresh = await fsmClient.request("getQuestionnaire", null, {
        coupleId,
      });
      if (!active.current) return;
      accept(fresh);
      if (keepLocal && fresh.status !== "draft") {
        setError(
          "Another tab submitted these answers. Use the saved answers, then choose Edit my answers to reopen them.",
        );
        return;
      }
      const next = questionnaireDraft(fresh);
      if (keepLocal && fresh.status === "draft")
        for (const [code, value] of edits.current) next[code] = value;
      else edits.current.clear();
      setDraft(next);
      setConsent(fresh.consent);
      blocked.current = false;
      setConflict(false);
      setError("");
      setDirty(edits.current.size > 0);
    } catch (error) {
      if (active.current) setError(sessionError(error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return {
    questionnaire,
    draft,
    consent,
    setConsent,
    error,
    conflict,
    dirty,
    busy,
    loading,
    load,
    flush,
    mutate,
    updateAnswer,
    reviewConflict,
  };
}
