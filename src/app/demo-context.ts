import { createContext } from "react";
import type {
  DraftAnswers,
  DraftValue,
} from "../features/questionnaire/validation";
import type {
  DebtExpectation,
  EmergencyRule,
  PersonalSpendingRule,
  PrivacyConsent,
  QuestionCode,
  ReviewFrequency,
} from "../types/domain";

export interface AgreementDraftInputs {
  personalSpending: PersonalSpendingRule;
  debtExpectation: DebtExpectation;
  threshold: string;
  emergencyRule: EmergencyRule;
  reviewFrequency: ReviewFrequency;
  reviewDate: string;
}
export interface DemoState {
  answers: DraftAnswers;
  consent: PrivacyConsent;
  questionnaireComplete: boolean;
  agreement: AgreementDraftInputs;
  updateAnswer: (code: QuestionCode, value: DraftValue) => void;
  loadExample: () => void;
  updateConsent: (value: PrivacyConsent) => void;
  finishQuestionnaire: () => void;
  updateAgreement: (value: AgreementDraftInputs) => void;
  reset: () => void;
}
export const DemoContext = createContext<DemoState | null>(null);
