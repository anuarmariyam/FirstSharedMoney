import { questions } from "../../src/features/questionnaire/catalog.ts";
import { toAnswerValue } from "../../src/features/questionnaire/answer-adapter.ts";
import type { AnswerValue, QuestionCode } from "../../src/types/domain.ts";

/** Fictional, deterministic validation fixtures; not financial engine results. */
export const questionnaireValues = Object.fromEntries(
  questions.map((q) => {
    const draft =
      q.kind === "money"
        ? "1000.25"
        : q.kind === "slider"
          ? "4000"
          : q.kind === "text"
            ? "Sample private note"
            : q.kind === "multiple_choice"
              ? [q.options[0].value]
              : q.options[0].value;
    return [q.code, toAnswerValue(q, draft)];
  }),
) as Record<QuestionCode, AnswerValue>;
