import type {
  CreateScenarioRequest,
  ComparisonResponse,
} from "../../../src/types/api.ts";
import type {
  Answer,
  ByPartner,
  ConflictResult,
  FinancialScenario,
  Question,
  QuestionCode,
} from "../../../src/types/domain.ts";
import type {
  ComparableQuestionCode,
  ComparisonQuestionnaire,
} from "../../../src/types/engines.ts";
import {
  financialEngine,
  financialInput,
  fields,
  money,
  record,
  revisions,
  sharedExpenses,
  splitModel,
  stressTest,
} from "../../../src/engines/financial.ts";
import { questions } from "../../../src/features/questionnaire/catalog.ts";
import { answerValue, revision, sameJSON } from "./questionnaire-contract.ts";
import { uuid } from "./session-contract.ts";

export function createScenarioRequest(value: unknown): CreateScenarioRequest {
  const row = record(value);
  fields(row, [
    "requestId",
    "expectedRevisions",
    "sharedExpenses",
    "sharedEmergencyFundCents",
    "model",
    "stressTest",
  ]);
  return {
    requestId: uuid<"request">(row.requestId),
    expectedRevisions: revisions(row.expectedRevisions),
    sharedExpenses: sharedExpenses(row.sharedExpenses),
    sharedEmergencyFundCents: money(row.sharedEmergencyFundCents),
    model: splitModel(row.model),
    stressTest: stressTest(row.stressTest),
  };
}
export function comparisonInputs(
  value: unknown,
): ByPartner<ComparisonQuestionnaire> {
  const row = record(value);
  fields(row, ["A", "B"]);
  const canonical = questions.filter((q) => q.comparisonRule !== "none");
  const parse = (value: unknown): ComparisonQuestionnaire => {
    const q = record(value);
    if (
      q.catalogVersion !== 1 ||
      !sameJSON(q.questions, canonical) ||
      !Array.isArray(q.answers)
    )
      throw new Error("INVALID_INPUT");
    const seen = new Set<QuestionCode>();
    const answers = q.answers.map((value): Answer<ComparableQuestionCode> => {
      const a = record(value),
        question = canonical.find((q) => q.code === a.questionCode);
      if (
        !question ||
        seen.has(question.code) ||
        a.catalogVersion !== 1 ||
        typeof a.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(a.updatedAt))
      )
        throw new Error("INVALID_INPUT");
      seen.add(question.code);
      return {
        id: uuid<"answer">(a.id),
        coupleId: uuid<"couple">(a.coupleId),
        partnerId: uuid<"partner">(a.partnerId),
        catalogVersion: 1,
        questionCode: question.code,
        value: answerValue(question.code, a.value),
        updatedAt: a.updatedAt as Answer["updatedAt"],
      } as Answer<ComparableQuestionCode>;
    });
    return {
      catalogVersion: 1,
      revision: revision(q.revision),
      questions: canonical as readonly Question<ComparableQuestionCode>[],
      answers,
    };
  };
  return { A: parse(row.A), B: parse(row.B) };
}
export function parseComparison(value: unknown): ComparisonResponse {
  const row = record(value);
  fields(row, ["sourceRevisions", "results"]);
  const canonical = questions.filter((q) => q.comparisonRule !== "none");
  if (!Array.isArray(row.results) || row.results.length !== canonical.length)
    throw new Error("INVALID_INPUT");
  const results = row.results.map((value, index): ConflictResult => {
    const result = record(value),
      question = canonical[index];
    fields(result, [
      "questionCode",
      "category",
      "discussionPromptCode",
      "status",
      "reason",
    ]);
    if (
      result.questionCode !== question.code ||
      result.category !== question.category ||
      result.discussionPromptCode !== `compare_${question.code}`
    )
      throw new Error("INVALID_INPUT");
    const base = {
      questionCode: question.code,
      category: question.category,
      discussionPromptCode: result.discussionPromptCode as string,
    };
    if (result.status === "aligned" && result.reason === "same_preference")
      return {
        ...base,
        status: "aligned" as const,
        reason: "same_preference" as const,
      };
    if (
      result.status === "different" &&
      result.reason === "different_expectations"
    )
      return {
        ...base,
        status: "different" as const,
        reason: "different_expectations" as const,
      };
    if (
      result.status === "unresolved" &&
      (result.reason === "missing_answer" ||
        result.reason === "decision_required")
    )
      return { ...base, status: "unresolved" as const, reason: result.reason };
    throw new Error("INVALID_INPUT");
  });
  return { sourceRevisions: revisions(row.sourceRevisions), results };
}
export function parseScenario(value: unknown): FinancialScenario {
  const row = record(value);
  const input = financialInput(row.input),
    model = splitModel(row.model),
    stress = stressTest(row.stressTest);
  const output = financialEngine.simulate(input, model, stress);
  if (
    input.oneOffSharedExpenseCents !== 0 ||
    !sameJSON(row.output, output) ||
    typeof row.createdAt !== "string" ||
    !Number.isFinite(Date.parse(row.createdAt))
  )
    throw new Error("INVALID_INPUT");
  return {
    id: uuid<"scenario">(row.id),
    coupleId: uuid<"couple">(row.coupleId),
    createdByPartnerId: uuid<"partner">(row.createdByPartnerId),
    input,
    model,
    stressTest: stress,
    output,
    createdAt: row.createdAt as FinancialScenario["createdAt"],
  };
}
