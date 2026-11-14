import { basisPoints, cents, MAX_CENTS } from "../../lib/money.ts";
import type { Question, QuestionCategory } from "../../types/domain";

const money = {
  kind: "money",
  minCents: cents(0),
  maxCents: cents(MAX_CENTS),
} as const;
const base = { catalogVersion: 1, required: true } as const;
export const questions = [
  {
    ...base,
    ...money,
    code: "monthly_income",
    position: 1,
    category: "income_obligations",
    title: "What is your monthly take-home income?",
    helpText:
      "After taxes. Include reliable recurring income only. Use fictional information in this preview.",
    comparisonRule: "none",
  },
  {
    ...base,
    ...money,
    code: "personal_obligations",
    position: 2,
    category: "income_obligations",
    title:
      "What do you pay monthly for personal obligations outside this shared budget?",
    helpText:
      "Include minimum debt payments or support. Exclude expenses you plan to share.",
    comparisonRule: "none",
  },
  {
    ...base,
    code: "shared_categories",
    position: 3,
    category: "shared_expenses",
    title: "Which categories would you like to plan together?",
    helpText:
      "Choose at least one. You can still discuss the details together later.",
    kind: "multiple_choice",
    comparisonRule: "set_equality",
    options: [
      { value: "rent", label: "Rent & home" },
      { value: "utilities", label: "Utilities" },
      { value: "groceries", label: "Groceries" },
      { value: "other", label: "Other shared costs" },
      { value: "shared_savings", label: "Shared savings" },
    ],
  },
  {
    ...base,
    ...money,
    code: "shared_budget_estimate",
    position: 4,
    category: "shared_expenses",
    title:
      "What monthly total do you expect for shared living expenses, before shared savings?",
    helpText:
      "Your estimate for the whole household, not just your contribution.",
    comparisonRule: "exact",
  },
  {
    ...base,
    code: "split_preference",
    position: 5,
    category: "expense_split",
    title: "How would you prefer to divide shared costs?",
    helpText:
      "There is no right answer. Start with what feels comfortable to you.",
    kind: "single_choice",
    comparisonRule: "exact",
    options: [
      { value: "equal", label: "Equal split — the same dollar amount" },
      { value: "proportional", label: "Proportional — based on our incomes" },
      { value: "custom", label: "Custom — a percentage we choose together" },
    ],
  },
  {
    ...base,
    ...money,
    code: "monthly_shared_savings",
    position: 6,
    category: "savings",
    title:
      "How much would you like the two of you to save together each month?",
    helpText: "A household target, separate from your personal savings.",
    comparisonRule: "exact",
  },
  {
    ...base,
    code: "personal_spending",
    position: 7,
    category: "personal_spending",
    title: "How should personal purchases be handled?",
    helpText: "Think about the independence you each want to keep.",
    kind: "single_choice",
    comparisonRule: "exact",
    options: [
      { value: "independent", label: "Keep personal purchases independent" },
      {
        value: "discuss_above_threshold",
        label: "Discuss purchases above an agreed amount",
      },
    ],
  },
  {
    ...base,
    code: "debt_expectation",
    position: 8,
    category: "debt",
    title: "How should existing personal debt affect your shared plan?",
    helpText: "No account details or debt identifiers are needed.",
    kind: "single_choice",
    comparisonRule: "exact",
    options: [
      {
        value: "individual_responsibility",
        label: "Each person remains responsible for their debt",
      },
      {
        value: "discuss_support",
        label: "Discuss any support before including it in our plan",
      },
    ],
  },
  {
    ...base,
    code: "emergency_preference",
    position: 9,
    category: "emergency",
    title: "What should happen first when an unexpected shared cost appears?",
    helpText:
      "A starting point for your conversation, not an automatic financial decision.",
    kind: "single_choice",
    comparisonRule: "exact",
    options: [
      {
        value: "shared_reserve_first",
        label: "Use our shared emergency reserve first",
      },
      { value: "pause_savings_first", label: "Pause shared savings first" },
      {
        value: "discuss_each_event",
        label: "Discuss each situation before deciding",
      },
    ],
  },
  {
    ...base,
    ...money,
    code: "emergency_fund_target",
    position: 10,
    category: "emergency",
    title: "What shared emergency-fund balance would you like to aim for?",
    helpText: "Your target balance, not the amount available right now.",
    comparisonRule: "exact",
  },
  {
    ...base,
    ...money,
    code: "large_purchase_threshold",
    position: 11,
    category: "large_purchase",
    title:
      "Above what purchase amount should you discuss a shared decision first?",
    helpText: "The amount for one purchase, not a monthly spending limit.",
    comparisonRule: "exact",
  },
  {
    ...base,
    code: "transparency_preference",
    position: 12,
    category: "transparency",
    title:
      "What level of financial detail would you feel comfortable discussing?",
    helpText: "This preference does not grant permission to share your data.",
    kind: "single_choice",
    comparisonRule: "exact",
    options: [
      { value: "shared_totals_only", label: "Shared totals only" },
      {
        value: "voluntary_details",
        label: "More detail, when we each choose to share it",
      },
      { value: "prefer_private", label: "Keep most financial details private" },
    ],
  },
  {
    ...base,
    code: "review_frequency",
    position: 13,
    category: "reviews",
    title: "How often would you like to review the shared budget?",
    helpText: "Choose a rhythm that could work for both of you.",
    kind: "single_choice",
    comparisonRule: "exact",
    options: [
      { value: "monthly", label: "Every month" },
      { value: "quarterly", label: "Every three months" },
      { value: "as_needed", label: "When something changes" },
    ],
  },
  {
    ...base,
    code: "comfortable_income_share",
    position: 14,
    category: "expense_split",
    title:
      "What percentage of your own take-home income could comfortably go toward shared costs?",
    helpText:
      "This is your comfort level, not the percentage split between partners.",
    kind: "slider",
    minBasisPoints: basisPoints(0),
    maxBasisPoints: basisPoints(10_000),
    stepBasisPoints: 100,
    comparisonRule: "none",
  },
  {
    ...base,
    required: false,
    code: "discussion_note",
    position: 15,
    category: "transparency",
    title:
      "Is there anything else you would like to prepare for your money conversation?",
    helpText:
      "Optional. In the live product this note will remain author-only. Do not enter sensitive information here.",
    kind: "text",
    maxLength: 500,
    comparisonRule: "none",
  },
] as const satisfies readonly Question[];

export const categoryLabels: Record<QuestionCategory, string> = {
  income_obligations: "Your financial starting point",
  shared_expenses: "Your shared everyday",
  expense_split: "Finding your balance",
  savings: "Goals worth sharing",
  personal_spending: "Room to be yourself",
  debt: "Existing responsibilities",
  emergency: "Planning for the unexpected",
  large_purchase: "The bigger decisions",
  transparency: "Your comfort & boundaries",
  reviews: "Keep the conversation going",
};
