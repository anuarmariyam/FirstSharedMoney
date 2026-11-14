import { questions } from "../features/questionnaire/catalog.ts";
import type { ConflictDetectionEngine } from "../types/engines.ts";
import type { ConflictResult } from "../types/domain.ts";

export const conflictEngine: ConflictDetectionEngine = {
  compare({ A, B }) {
    if (A.catalogVersion !== 1 || B.catalogVersion !== 1)
      throw new Error("INVALID_INPUT");
    return questions
      .filter((q) => q.comparisonRule !== "none")
      .map((q): ConflictResult => {
        const base = {
          questionCode: q.code,
          category: q.category,
          discussionPromptCode: `compare_${q.code}`,
        };
        const aa = A.answers.find((a) => a.questionCode === q.code),
          bb = B.answers.find((a) => a.questionCode === q.code);
        if (
          !aa ||
          !bb ||
          !A.questions.some((a) => a.code === q.code) ||
          !B.questions.some((b) => b.code === q.code)
        )
          return { ...base, status: "unresolved", reason: "missing_answer" };
        if (aa.value.kind !== q.kind || bb.value.kind !== q.kind)
          throw new Error("INVALID_INPUT");
        if (
          q.code === "split_preference" &&
          aa.value.kind === "single_choice" &&
          bb.value.kind === "single_choice" &&
          aa.value.value === "custom" &&
          bb.value.value === "custom"
        )
          return { ...base, status: "unresolved", reason: "decision_required" };
        let same: boolean;
        if (
          aa.value.kind === "multiple_choice" &&
          bb.value.kind === "multiple_choice"
        )
          same =
            JSON.stringify([...new Set(aa.value.values)].sort()) ===
            JSON.stringify([...new Set(bb.value.values)].sort());
        else if (aa.value.kind === "money" && bb.value.kind === "money")
          same = aa.value.cents === bb.value.cents;
        else if (
          aa.value.kind === "single_choice" &&
          bb.value.kind === "single_choice"
        )
          same = aa.value.value === bb.value.value;
        else throw new Error("INVALID_INPUT");
        return same
          ? { ...base, status: "aligned", reason: "same_preference" }
          : { ...base, status: "different", reason: "different_expectations" };
      });
  },
};
