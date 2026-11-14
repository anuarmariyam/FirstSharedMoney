import { useState, type ReactNode } from "react";
import { DemoContext, type AgreementDraftInputs } from "./demo-context";
import type {
  DraftAnswers,
  DraftValue,
} from "../features/questionnaire/validation";
import type { PrivacyConsent, QuestionCode } from "../types/domain";

function defaultAgreement(): AgreementDraftInputs {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 30);
  return {
    personalSpending: "independent",
    debtExpectation: "individual_responsibility",
    threshold: "500",
    emergencyRule: "use_shared_reserve_then_discuss",
    reviewFrequency: "monthly",
    reviewDate: date.toISOString().slice(0, 10),
  };
}
export function DemoProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<DraftAnswers>({});
  const [consent, setConsent] = useState<PrivacyConsent>({
    comparison: false,
    budget: false,
  });
  const [complete, setComplete] = useState(false);
  const [agreement, setAgreement] = useState(defaultAgreement);
  function updateAnswer(code: QuestionCode, value: DraftValue) {
    setAnswers((previous) => ({ ...previous, [code]: value }));
    setComplete(false);
    setConsent({ comparison: false, budget: false });
  }
  function loadExample() {
    setAnswers({
      monthly_income: "5000",
      personal_obligations: "600",
      shared_categories: ["rent", "utilities", "groceries", "other"],
      shared_budget_estimate: "3200",
      split_preference: "equal",
      monthly_shared_savings: "0",
      personal_spending: "independent",
      debt_expectation: "individual_responsibility",
      emergency_preference: "shared_reserve_first",
      emergency_fund_target: "6000",
      large_purchase_threshold: "500",
      transparency_preference: "shared_totals_only",
      review_frequency: "monthly",
      comfortable_income_share: "4000",
      discussion_note: "",
    });
    setComplete(false);
    setConsent({ comparison: false, budget: false });
  }
  function reset() {
    setAnswers({});
    setConsent({ comparison: false, budget: false });
    setComplete(false);
    setAgreement(defaultAgreement());
  }
  return (
    <DemoContext.Provider
      value={{
        answers,
        consent,
        questionnaireComplete: complete,
        agreement,
        updateAnswer,
        loadExample,
        updateConsent: setConsent,
        finishQuestionnaire: () => setComplete(true),
        updateAgreement: setAgreement,
        reset,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
