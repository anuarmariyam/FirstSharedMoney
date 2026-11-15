import type { Cents, SplitCalculation } from "../../types/domain";
import { formatMoney } from "../../lib/money";

type AvailableSplit = Extract<SplitCalculation, { status: "available" }>;

export function BudgetOverview({
  result,
  sharedSavingsCents,
  reserveCents,
}: {
  result: AvailableSplit;
  sharedSavingsCents: Cents;
  reserveCents: Cents;
}) {
  return (
    <div
      className="budget-overview-cards"
      role="group"
      aria-label="Budget overview"
    >
      <div>
        <span>Shared monthly plan</span>
        <strong>{formatMoney(result.monthlySharedTotalCents)}</strong>
        <small>Includes shared savings</small>
      </div>
      <div>
        <span>Shared savings / month</span>
        <strong>{formatMoney(sharedSavingsCents)}</strong>
        <small>Already in the monthly plan</small>
      </div>
      <div>
        <span>Emergency reserve</span>
        <strong>{formatMoney(reserveCents)}</strong>
        <small>Available now · separate from income</small>
      </div>
    </div>
  );
}
