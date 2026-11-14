import { parseMoneyInput } from "../../lib/money";
import type { Question, QuestionCode } from "../../types/domain";

export type DraftValue = string | readonly string[];
export type DraftAnswers = Partial<Record<QuestionCode, DraftValue>>;
export function validateAnswer(
  question: Question,
  value: DraftValue | undefined,
): string | null {
  if (question.kind === "text") {
    if (value === undefined) return null;
    if (typeof value !== "string") return "Write your note in plain text.";
    return value.length > question.maxLength
      ? `Keep your note to ${question.maxLength} characters.`
      : null;
  }
  if (value === undefined || value === "")
    return "Add an answer before continuing.";
  if (question.kind === "money") {
    if (typeof value !== "string") return "Enter a dollar amount.";
    const result = parseMoneyInput(value);
    return result.ok ? null : result.error;
  }
  if (question.kind === "single_choice")
    return typeof value === "string" &&
      question.options.some((option) => option.value === value)
      ? null
      : "Choose one of the options.";
  if (question.kind === "multiple_choice")
    return Array.isArray(value) &&
      value.length > 0 &&
      new Set(value).size === value.length &&
      value.every((item) =>
        question.options.some((option) => option.value === item),
      )
      ? null
      : "Choose at least one category.";
  return typeof value === "string" &&
    /^\d+$/.test(value) &&
    Number(value) >= 0 &&
    Number(value) <= 10_000 &&
    Number(value) % 100 === 0
    ? null
    : "Choose a percentage from 0% to 100%.";
}
