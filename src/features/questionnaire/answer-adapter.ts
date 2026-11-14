import { answerValue } from "../../../supabase/functions/_shared/questionnaire-contract.ts";
import { parseMoneyInput } from "../../lib/money.ts";
import type { AnswerValue, Question, Questionnaire } from "../../types/domain";
import type { DraftAnswers, DraftValue } from "./validation";

export function toAnswerValue(
  question: Question,
  draft: DraftValue,
): AnswerValue {
  let value: unknown;
  switch (question.kind) {
    case "money": {
      const result = parseMoneyInput(typeof draft === "string" ? draft : "");
      if (!result.ok) throw new Error("INVALID_INPUT");
      value = { kind: "money", cents: result.value };
      break;
    }
    case "slider":
      value = {
        kind: "slider",
        basisPoints:
          typeof draft === "string" && /^\d+$/.test(draft)
            ? Number(draft)
            : null,
      };
      break;
    case "single_choice":
      value = { kind: "single_choice", value: draft };
      break;
    case "multiple_choice":
      value = { kind: "multiple_choice", values: draft };
      break;
    case "text":
      value = { kind: "text", text: draft };
  }
  return answerValue(question.code, value);
}
export function fromAnswerValue(value: AnswerValue): DraftValue {
  switch (value.kind) {
    case "money":
      return `${Math.floor(value.cents / 100)}.${String(value.cents % 100).padStart(2, "0")}`;
    case "slider":
      return String(value.basisPoints);
    case "single_choice":
      return value.value;
    case "multiple_choice":
      return value.values;
    case "text":
      return value.text;
  }
}
export function questionnaireDraft(questionnaire: Questionnaire): DraftAnswers {
  return Object.fromEntries(
    questionnaire.answers.map((answer) => [
      answer.questionCode,
      fromAnswerValue(answer.value),
    ]),
  );
}
