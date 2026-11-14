import { questions } from "../../../src/features/questionnaire/catalog.ts";
import type {
  Answer,
  AnswerValueByQuestion,
  PrivacyConsent,
  QuestionCode,
  Questionnaire,
  Revision,
} from "../../../src/types/domain.ts";
import { exactKeys, object, uuid } from "./session-contract.ts";

export function revision(value: unknown): Revision {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 2147483647
  )
    throw new Error("INVALID_INPUT");
  return value as Revision;
}
export function questionCode(value: unknown): QuestionCode {
  if (typeof value !== "string" || !questions.some((q) => q.code === value))
    throw new Error("INVALID_INPUT");
  return value as QuestionCode;
}
export function privacyConsent(value: unknown): PrivacyConsent {
  const row = object(value);
  exactKeys(row, ["comparison", "budget"]);
  if (typeof row.comparison !== "boolean" || typeof row.budget !== "boolean")
    throw new Error("INVALID_INPUT");
  return { comparison: row.comparison, budget: row.budget };
}
export function answerValue<Code extends QuestionCode>(
  code: Code,
  value: unknown,
): AnswerValueByQuestion[Code] {
  const q = questions.find((q) => q.code === code);
  const row = object(value);
  if (
    !q ||
    row.kind !== q.kind ||
    new TextEncoder().encode(JSON.stringify(row)).length > 4096
  )
    throw new Error("INVALID_INPUT");
  switch (q.kind) {
    case "money":
      exactKeys(row, ["kind", "cents"]);
      if (
        typeof row.cents !== "number" ||
        !Number.isSafeInteger(row.cents) ||
        row.cents < q.minCents ||
        row.cents > q.maxCents
      )
        throw new Error("INVALID_INPUT");
      break;
    case "slider":
      exactKeys(row, ["kind", "basisPoints"]);
      if (
        typeof row.basisPoints !== "number" ||
        !Number.isInteger(row.basisPoints) ||
        row.basisPoints < q.minBasisPoints ||
        row.basisPoints > q.maxBasisPoints ||
        (row.basisPoints - q.minBasisPoints) % q.stepBasisPoints !== 0
      )
        throw new Error("INVALID_INPUT");
      break;
    case "single_choice":
      exactKeys(row, ["kind", "value"]);
      if (
        typeof row.value !== "string" ||
        !q.options.some((option) => option.value === row.value)
      )
        throw new Error("INVALID_INPUT");
      break;
    case "multiple_choice":
      exactKeys(row, ["kind", "values"]);
      if (
        !Array.isArray(row.values) ||
        row.values.length === 0 ||
        new Set(row.values).size !== row.values.length ||
        row.values.some(
          (value) =>
            typeof value !== "string" ||
            !q.options.some((option) => option.value === value),
        )
      )
        throw new Error("INVALID_INPUT");
      return {
        kind: q.kind,
        values: [...row.values],
      } as unknown as AnswerValueByQuestion[Code];
    case "text":
      exactKeys(row, ["kind", "text"]);
      if (
        typeof row.text !== "string" ||
        Array.from(row.text).length > q.maxLength ||
        row.text.includes("\u0000")
      )
        throw new Error("INVALID_INPUT");
  }
  return { ...row } as unknown as AnswerValueByQuestion[Code];
}
function sameJSON(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return (
      a.length === b.length && a.every((value, i) => sameJSON(value, b[i]))
    );
  if (
    !a ||
    !b ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(a) ||
    Array.isArray(b)
  )
    return false;
  const aa = object(a),
    bb = object(b);
  return (
    Object.keys(aa).length === Object.keys(bb).length &&
    Object.keys(aa).every(
      (key) => Object.hasOwn(bb, key) && sameJSON(aa[key], bb[key]),
    )
  );
}
export function parseQuestionnaire(value: unknown): Questionnaire {
  const row = object(value);
  if (
    row.catalogVersion !== 1 ||
    !sameJSON(row.questions, questions) ||
    !Array.isArray(row.answers) ||
    row.answers.length > 15
  )
    throw new Error("INVALID_INPUT");
  const partnerId = uuid<"partner">(row.partnerId);
  const consent = privacyConsent(row.consent);
  const seen = new Set<QuestionCode>();
  const answers = row.answers.map((value): Answer => {
    const answer = object(value),
      code = questionCode(answer.questionCode);
    if (
      answer.catalogVersion !== 1 ||
      answer.partnerId !== partnerId ||
      seen.has(code) ||
      typeof answer.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(answer.updatedAt))
    )
      throw new Error("INVALID_INPUT");
    seen.add(code);
    return {
      id: uuid<"answer">(answer.id),
      coupleId: uuid<"couple">(answer.coupleId),
      partnerId,
      catalogVersion: 1,
      questionCode: code,
      value: answerValue(code, answer.value),
      updatedAt: answer.updatedAt as Answer["updatedAt"],
    } as Answer;
  });
  const base = {
    partnerId,
    catalogVersion: 1 as const,
    revision: revision(row.revision),
    questions,
    answers,
  };
  if (
    row.status === "draft" &&
    row.submittedAt === null &&
    !consent.comparison &&
    !consent.budget
  )
    return {
      ...base,
      status: "draft",
      submittedAt: null,
      consent: { comparison: false, budget: false },
    };
  if (
    row.status === "submitted" &&
    typeof row.submittedAt === "string" &&
    Number.isFinite(Date.parse(row.submittedAt)) &&
    questions.filter((q) => q.required).every((q) => seen.has(q.code))
  )
    return {
      ...base,
      status: "submitted",
      submittedAt: row.submittedAt as NonNullable<Questionnaire["submittedAt"]>,
      consent,
    };
  throw new Error("INVALID_INPUT");
}
