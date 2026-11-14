import type { AgreementDraftInputs } from "../../app/demo-context";
import { parseMoneyInput } from "../../lib/money";

export function validateAgreementDraft(
  draft: AgreementDraftInputs,
): Partial<Record<"threshold" | "reviewDate", string>> {
  const errors: Partial<Record<"threshold" | "reviewDate", string>> = {};
  const threshold = parseMoneyInput(draft.threshold);
  if (!threshold.ok) errors.threshold = threshold.error;
  const date = new Date(`${draft.reviewDate}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setUTCDate(max.getUTCDate() + 366);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.reviewDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== draft.reviewDate ||
    date <= today ||
    date > max
  )
    errors.reviewDate =
      "Choose a real date after today, within the next 366 days.";
  return errors;
}
