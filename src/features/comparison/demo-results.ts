import type { ConflictResult } from "../../types/domain";

/** Editorial examples only. No comparison of the visitor's draft is performed. */
export const comparisonFixtures = [
  {
    questionCode: "personal_spending",
    category: "personal_spending",
    status: "aligned",
    reason: "same_preference",
    discussionPromptCode: "personal_independence",
  },
  {
    questionCode: "review_frequency",
    category: "reviews",
    status: "aligned",
    reason: "same_preference",
    discussionPromptCode: "monthly_conversation",
  },
  {
    questionCode: "split_preference",
    category: "expense_split",
    status: "different",
    reason: "different_expectations",
    discussionPromptCode: "explore_splits",
  },
  {
    questionCode: "emergency_preference",
    category: "emergency",
    status: "different",
    reason: "different_expectations",
    discussionPromptCode: "prepare_for_surprises",
  },
  {
    questionCode: "large_purchase_threshold",
    category: "large_purchase",
    status: "unresolved",
    reason: "decision_required",
    discussionPromptCode: "choose_a_threshold",
  },
] as const satisfies readonly ConflictResult[];
export const comparisonCopy: Record<
  string,
  { title: string; text: string; prompt: string }
> = {
  personal_independence: {
    title: "Space for personal spending",
    text: "In this example, both people value keeping personal purchases independent.",
    prompt:
      "What would help each of you feel comfortable with that independence?",
  },
  monthly_conversation: {
    title: "A regular money conversation",
    text: "Both example partners would like to revisit their budget every month.",
    prompt: "Choose a time that feels easy to keep, not another chore.",
  },
  explore_splits: {
    title: "How to share the everyday",
    text: "The example partners prefer different approaches to splitting shared expenses.",
    prompt:
      "Look at equal and income-based models together. What feels workable to each of you?",
  },
  prepare_for_surprises: {
    title: "A plan for the unexpected",
    text: "The example partners have different first instincts when a surprise cost comes up.",
    prompt:
      "When would you use a shared reserve, and when would you pause to discuss?",
  },
  choose_a_threshold: {
    title: "When to check in first",
    text: "A concrete purchase-discussion threshold still needs a shared decision in this illustration.",
    prompt: "What amount would you both want to talk about before spending?",
  },
};
